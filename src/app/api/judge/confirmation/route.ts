import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { verifyHash, JudgeAssignmentRecord } from '@/domain/judgeAuth';
import {
  buildGreenRoomRosterSnapshot,
  assertGreenRoomEntryMatchesRegistration
} from '@/domain/greenRoomRoster';

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
    await syncWorkloadIdentityToken();
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

    // New receipts carry the exact server-only Code Letter -> registration
    // snapshot. Verify it against the canonical current roster, but never return
    // registration IDs or participant identity to the judge.
    if (Array.isArray(markEntry.codeRegistrationSnapshot)) {
      const [rosterSnapshot, registrationsSnapshot] = await Promise.all([
        db.collection('greenRoomAssignments')
          .where('competitionId', '==', competitionId)
          .get(),
        db.collection('registrations')
          .where('competitionId', '==', competitionId)
          .get()
      ]);
      const roster = buildGreenRoomRosterSnapshot(
        competitionId,
        rosterSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      );
      const registrationById = new Map(
        registrationsSnapshot.docs.map(doc => [doc.id, doc.data() as Record<string, unknown>])
      );
      for (const entry of roster.entries) {
        const liveRegistration = registrationById.get(entry.registrationId);
        if (
          !liveRegistration ||
          String(liveRegistration.status || '').trim().toUpperCase() !== 'APPROVED'
        ) {
          throw new Error('Roster Integrity Error: The receipt cannot be matched to an approved registration.');
        }
        assertGreenRoomEntryMatchesRegistration(entry, liveRegistration);
      }
      const archivedMapping = markEntry.codeRegistrationSnapshot
        .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item: Record<string, unknown>) => ({
          registrationId: String(item.registrationId || ''),
          codeLetter: String(item.codeLetter || '').trim().toUpperCase(),
          codeIndex: Number(item.codeIndex)
        }))
        .sort((a: { codeIndex: number }, b: { codeIndex: number }) => a.codeIndex - b.codeIndex);
      const currentMapping = roster.entries.map(({ registrationId, codeLetter, codeIndex }) => ({
        registrationId,
        codeLetter,
        codeIndex
      }));
      if (
        markEntry.rosterVersion !== roster.version ||
        JSON.stringify(archivedMapping) !== JSON.stringify(currentMapping)
      ) {
        return error('The archived scorecard no longer matches the verified Green Room Code Letter roster.', 409);
      }

      const expectedRegistrationIds = roster.entries.map(entry => entry.registrationId).sort();
      if (JSON.stringify(scoreRegistrationIds.slice().sort()) !== JSON.stringify(expectedRegistrationIds)) {
        return error('The archived scorecard does not contain marks for the exact verified Green Room roster.', 409);
      }
      const expectedAnonymousRoster = roster.entries.map(({ codeLetter, codeIndex }) => ({ codeLetter, codeIndex }));
      if (JSON.stringify(anonymousRoster) !== JSON.stringify(expectedAnonymousRoster)) {
        return error('The archived anonymous Code Letter receipt does not match the verified Green Room roster.', 409);
      }
    } else if (anonymousRoster.length === 0 && scoreRegistrationIds.length > 0) {
      // Backward-compatible legacy receipt reconstruction still uses the same
      // fail-closed canonical mapping; duplicate codes are never overwritten.
      const [rosterSnapshot, registrationsSnapshot] = await Promise.all([
        db.collection('greenRoomAssignments')
          .where('competitionId', '==', competitionId)
          .get(),
        db.collection('registrations')
          .where('competitionId', '==', competitionId)
          .get()
      ]);
      const roster = buildGreenRoomRosterSnapshot(
        competitionId,
        rosterSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      );
      const registrationById = new Map(
        registrationsSnapshot.docs.map(doc => [doc.id, doc.data() as Record<string, unknown>])
      );
      for (const entry of roster.entries) {
        const liveRegistration = registrationById.get(entry.registrationId);
        if (
          !liveRegistration ||
          String(liveRegistration.status || '').trim().toUpperCase() !== 'APPROVED'
        ) {
          throw new Error('Roster Integrity Error: The receipt cannot be matched to an approved registration.');
        }
        assertGreenRoomEntryMatchesRegistration(entry, liveRegistration);
      }
      anonymousRoster = scoreRegistrationIds
        .map(registrationId => {
          const item = roster.registrationToCode.get(registrationId);
          return item ? { codeLetter: item.codeLetter, codeIndex: item.codeIndex } : undefined;
        })
        .filter((item): item is { codeLetter: string; codeIndex: number } => Boolean(item));
      if (anonymousRoster.length !== scoreRegistrationIds.length) {
        return error('The legacy scorecard cannot be matched to the verified Green Room roster.', 409);
      }
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
    const message = cause instanceof Error ? cause.message : 'unknown error';
    console.error('[JudgeConfirmation] Receipt verification failed:', message);
    if (message.includes('Roster Integrity Error')) {
      return error('The official receipt cannot be matched to a verified Green Room Code Letter roster.', 409);
    }
    return error('The official receipt could not be verified. Please retry using the original judge session.', 500);
  }
}
