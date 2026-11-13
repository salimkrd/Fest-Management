import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { verifyJudgeAssignment, JudgeAssignmentRecord } from '@/domain/judgeAuth';

export const dynamic = 'force-dynamic';

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

/**
 * Returns only the assigned competition rubric, anonymous Green Room code letters,
 * and the current draft scorecard. No contestant identity or contact data leaves Admin SDK.
 */
export async function POST(req: NextRequest) {
  try {
    await syncWorkloadIdentityToken();
    const body = await req.json().catch(() => null);
    const assignmentId = typeof body?.assignmentId === 'string' ? body.assignmentId.trim() : '';
    const competitionId = typeof body?.competitionId === 'string' ? body.competitionId.trim() : '';
    const secret = typeof body?.secret === 'string' ? body.secret.trim() : '';

    if (!assignmentId || !competitionId || !secret) {
      return error('The secure judge session is incomplete. Sign in again using the official invitation.', 400);
    }

    const db = getAdminDb();
    if (!db) return error('The judging service is temporarily unavailable. Please try again.', 503);

    const assignmentDoc = await db.collection('judgeAssignments').doc(assignmentId).get();
    if (!assignmentDoc.exists) return error('This judge assignment could not be found. Sign in again.', 404);

    const assignment = { ...assignmentDoc.data(), id: assignmentDoc.id } as JudgeAssignmentRecord;
    if (assignment.competitionId !== competitionId) {
      return error('This secure link does not match the assigned competition.', 403);
    }
    if (assignment.revoked || assignment.status === 'REVOKED') {
      return error('This judge assignment has been revoked by the administrator.', 403);
    }

    const isSubmitted = assignment.status === 'SUBMITTED';
    if (!isSubmitted && (assignment.status === 'EXPIRED' || (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()))) {
      return error('This judge assignment has expired. Contact the festival administrator.', 410);
    }

    const verification = await verifyJudgeAssignment(assignment, secret);
    if (!verification.valid) return error('The secure judge session could not be verified. Please sign in again.', 401);

    const [competitionDoc, greenRoomSnapshot, markEntryDoc] = await Promise.all([
      db.collection('competitions').doc(competitionId).get(),
      db.collection('greenRoomAssignments').where('competitionId', '==', competitionId).get(),
      db.collection('markEntries').doc(`me-${assignmentId}`).get()
    ]);

    if (!competitionDoc.exists) return error('The assigned competition is no longer available.', 404);
    const rawCompetition = competitionDoc.data() || {};
    const criteria = Array.isArray(rawCompetition.criteria)
      ? (rawCompetition.criteria as Array<Record<string, unknown>>)
          .map(item => ({
            id: String(item.id || ''),
            name: String(item.name || ''),
            maxMarks: Number(item.maxMarks || 0)
          }))
          .filter(item => Boolean(item.id && item.name && Number.isFinite(item.maxMarks) && item.maxMarks > 0))
      : [];

    const roster = greenRoomSnapshot.docs
      .map(doc => {
        const data = doc.data() as Record<string, unknown>;
        return {
          documentId: doc.id,
          registrationId: typeof data.registrationId === 'string' ? data.registrationId : '',
          codeLetter: typeof data.codeLetter === 'string' ? data.codeLetter.trim().toUpperCase() : '',
          codeIndex: Number.isFinite(Number(data.codeIndex)) ? Number(data.codeIndex) : null,
          status: String(data.status || 'CHECKED_IN')
        };
      })
      .filter(item => Boolean(item.registrationId && /^[A-Z]{1,2}$/.test(item.codeLetter)))
      .map((item, index: number) => ({
        registrationId: item.registrationId,
        codeLetter: item.codeLetter,
        codeIndex: item.codeIndex !== null ? item.codeIndex : index,
        status: item.status
      }))
      .sort((a, b) => a.codeIndex - b.codeIndex);

    const codeByRegistration = new Map<string, string>(roster.map(item => [item.registrationId, item.codeLetter] as [string, string]));
    const rawMarkEntry = markEntryDoc.exists ? markEntryDoc.data() || {} : {};
    const rawScores = rawMarkEntry.status === 'DRAFT' && rawMarkEntry.scores && typeof rawMarkEntry.scores === 'object'
      ? rawMarkEntry.scores as Record<string, unknown>
      : {};

    const draftScores: Record<string, Record<string, number> | number> = {};
    let staleDraft = false;
    for (const [registrationId, value] of Object.entries(rawScores)) {
      const codeLetter = codeByRegistration.get(registrationId);
      if (!codeLetter) {
        staleDraft = true;
        continue;
      }
      draftScores[codeLetter] = value as Record<string, number> | number;
    }

    const assignmentRecord = assignment as unknown as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      isSubmitted,
      verificationHash: isSubmitted ? assignmentRecord.verificationHash || rawMarkEntry.verificationHash || '' : '',
      submittedAt: isSubmitted ? assignmentRecord.submittedAt || rawMarkEntry.submittedAt || '' : '',
      assignment: {
        id: assignmentDoc.id,
        competitionId,
        status: assignment.status || 'ACTIVE',
        expiresAt: assignment.expiresAt || ''
      },
      competition: {
        id: competitionDoc.id,
        code: String(rawCompetition.code || assignment.competitionCode || ''),
        name: String(rawCompetition.name || assignment.competitionName || ''),
        categoryName: String(rawCompetition.categoryName || assignment.categoryName || ''),
        type: String(rawCompetition.type || assignment.type || ''),
        stageName: String(rawCompetition.stageName || assignment.stageName || ''),
        criteria
      },
      contestants: roster.map(({ codeLetter, codeIndex, status }) => ({ codeLetter, codeIndex, status })),
      scores: isSubmitted ? {} : draftScores,
      draftRemarks: rawMarkEntry.status === 'DRAFT' ? String(rawMarkEntry.remarks || '') : '',
      draftUpdatedAt: rawMarkEntry.status === 'DRAFT' ? String(rawMarkEntry.updatedAt || '') : '',
      staleDraft
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    console.error('[JudgeSession] Unable to load assigned judge session:', cause instanceof Error ? cause.message : 'unknown error');
    return error('The assigned judge session could not be loaded. Check your connection and retry.', 500);
  }
}
