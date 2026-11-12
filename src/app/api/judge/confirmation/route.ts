import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyHash, JudgeAssignmentRecord } from '@/domain/judgeAuth';

export const dynamic = 'force-dynamic';

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

/** Returns a server-verified, anonymous-only receipt for an already-submitted scorecard. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const assignmentId = typeof body?.assignmentId === 'string' ? body.assignmentId.trim() : '';
    const competitionId = typeof body?.competitionId === 'string' ? body.competitionId.trim() : '';
    const secret = typeof body?.secret === 'string' ? body.secret.trim() : '';
    const verificationHash = typeof body?.verificationHash === 'string' ? body.verificationHash.trim() : '';

    if (!assignmentId || !competitionId || !secret || !verificationHash) {
      return error('The receipt link is incomplete. Open the receipt from the completed judge session.', 400);
    }

    const db = getAdminDb();
    if (!db) return error('The receipt verification service is temporarily unavailable.', 503);

    const assignmentRef = db.collection('judgeAssignments').doc(assignmentId);
    const markEntryRef = db.collection('markEntries').doc(`me-${assignmentId}`);
    const [assignmentDoc, markEntryDoc, competitionDoc] = await Promise.all([
      assignmentRef.get(),
      markEntryRef.get(),
      db.collection('competitions').doc(competitionId).get()
    ]);

    if (!assignmentDoc.exists || !markEntryDoc.exists || !competitionDoc.exists) {
      return error('The submitted scorecard receipt could not be found.', 404);
    }

    const assignment = { ...assignmentDoc.data(), id: assignmentDoc.id } as JudgeAssignmentRecord;
    const markEntry = markEntryDoc.data() || {};
    if (assignment.competitionId !== competitionId || markEntry.competitionId !== competitionId || markEntry.assignmentId !== assignmentId) {
      return error('The receipt does not match this assigned competition.', 403);
    }
    if (assignment.revoked || assignment.status !== 'SUBMITTED' || markEntry.status !== 'SUBMITTED' || markEntry.isFinal !== true) {
      return error('This scorecard has not been finalized as an official submission.', 409);
    }

    const assignmentRecord = assignment as unknown as Record<string, unknown>;
    const storedHash = String(assignmentRecord.verificationHash || markEntry.verificationHash || '');
    if (!storedHash || storedHash !== verificationHash || String(markEntry.verificationHash || '') !== verificationHash) {
      return error('The digital verification hash does not match the archived scorecard.', 403);
    }
    const secretHash = assignment.secretHash || String(assignmentRecord.hashedSecret || '');
    if (!secretHash || !assignment.salt || !(await verifyHash(secret, secretHash, assignment.salt))) {
      return error('Judge session verification failed. Please use the original secure session.', 401);
    }

    const scoreRegistrationIds = markEntry.scores && typeof markEntry.scores === 'object'
      ? Object.keys(markEntry.scores)
      : [];
    let anonymousRoster: Array<{ codeLetter: string; codeIndex: number }> = [];
    if (Array.isArray(markEntry.anonymousRoster)) {
      anonymousRoster = markEntry.anonymousRoster
        .filter((item: unknown): item is { codeLetter?: unknown; codeIndex?: unknown } => Boolean(item && typeof item === 'object'))
        .filter(item => /^[A-Z]{1,2}$/.test(String(item.codeLetter || '').toUpperCase()))
        .map(item => ({
          codeLetter: String(item.codeLetter).toUpperCase(),
          codeIndex: Number.isFinite(Number(item.codeIndex)) ? Number(item.codeIndex) : 0
        }));
    }

    if (anonymousRoster.length === 0 && scoreRegistrationIds.length > 0) {
      const rosterSnapshot = await db.collection('greenRoomAssignments').where('competitionId', '==', competitionId).get();
      const assigned = new Map<string, { codeLetter: string; codeIndex: number }>();
      rosterSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        if (data.registrationId && data.codeLetter) {
          assigned.set(String(data.registrationId), {
            codeLetter: String(data.codeLetter).trim().toUpperCase(),
            codeIndex: Number.isFinite(Number(data.codeIndex)) ? Number(data.codeIndex) : index
          });
        }
      });
      anonymousRoster = scoreRegistrationIds
        .map(registrationId => assigned.get(registrationId))
        .filter((item): item is { codeLetter: string; codeIndex: number } => Boolean(item));
    }

    anonymousRoster.sort((a, b) => a.codeIndex - b.codeIndex);
    const rawCompetition = competitionDoc.data() || {};
    return NextResponse.json({
      success: true,
      verificationHash: storedHash,
      submittedAt: String(markEntry.submittedAt || assignmentRecord.submittedAt || ''),
      marksRecorded: scoreRegistrationIds.length,
      competition: {
        id: competitionDoc.id,
        code: String(rawCompetition.code || assignment.competitionCode || ''),
        name: String(rawCompetition.name || assignment.competitionName || ''),
        categoryName: String(rawCompetition.categoryName || assignment.categoryName || ''),
        type: String(rawCompetition.type || assignment.type || ''),
        stageName: String(rawCompetition.stageName || assignment.stageName || '')
      },
      contestants: anonymousRoster
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    console.error('[JudgeConfirmation] Receipt verification failed:', cause instanceof Error ? cause.message : 'unknown error');
    return error('The official receipt could not be verified. Please retry using the original judge session.', 500);
  }
}
