import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { JudgeService } from '@/services/judgeService';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { calculateGrade, getChampionshipPoints, Grade } from '@/domain/scoring';
import {
  recoverResultRankIntegrity,
  type RegistrationIdentityRecord,
  type GreenRoomAssignmentIdentityRecord
} from '@/domain/resultRankIntegrity';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await syncWorkloadIdentityToken();
    const authorization = req.headers.get('authorization') || '';
    const adminIdToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!adminIdToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing administrator authentication token.' }, { status: 401 });
    }

    await AuthService.assertAdmin(adminIdToken);
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 });
    }

    const { id } = await params;
    const body = await req.json();
    const resultRef = db.collection('results').doc(id);
    const resultSnapshot = await resultRef.get();
    if (!resultSnapshot.exists) {
      return NextResponse.json({ error: 'Result not found.' }, { status: 404 });
    }

    const result = resultSnapshot.data()!;
    if (body.action === 'CONFIRM') {
      if (!['READY_FOR_REVIEW', 'REVISION_REQUIRED'].includes(result.resultStatus)) {
        return NextResponse.json({ error: 'Validation Error: Result is not eligible for rank confirmation.' }, { status: 400 });
      }
      if (result.marksStatus !== 'COMPLETE') {
        return NextResponse.json({ error: 'Validation Error: Submitted marks must be complete before confirmation.' }, { status: 400 });
      }
      if (!Array.isArray(body.ranks) || body.ranks.length === 0) {
        return NextResponse.json({ error: 'Validation Error: Result ranks must be an array.' }, { status: 400 });
      }

      const competitionSnapshot = await db.collection('competitions').doc(result.competitionId).get();
      if (!competitionSnapshot.exists) {
        return NextResponse.json({ error: 'Validation Error: Competition no longer exists.' }, { status: 400 });
      }
      const maxMarks = 100;
      const rawRanks = body.ranks as Array<Record<string, unknown>>;
      if (rawRanks.some(rank =>
        !rank ||
        typeof rank !== 'object' ||
        typeof rank.registrationId !== 'string' ||
        !rank.registrationId.trim() ||
        typeof rank.score !== 'number' ||
        !Number.isFinite(rank.score) ||
        rank.score < 0 ||
        rank.score > maxMarks ||
        !([1, 2, 3, null].includes(rank.rank as number | null))
      )) {
        throw new Error('Validation Error: Result ranks contain invalid registration, mark or position data.');
      }

      const [sourceSnapshots, targetRegistrationsSnapshot, greenRoomAssignmentsSnapshot] = await Promise.all([
        Promise.all(rawRanks.map(rank =>
          db.collection('registrations').doc(String(rank.registrationId)).get()
        )),
        db.collection('registrations')
          .where('competitionId', '==', result.competitionId)
          .get(),
        db.collection('greenRoomAssignments')
          .where('competitionId', '==', result.competitionId)
          .get()
      ]);
      const targetRegistrations = targetRegistrationsSnapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
      } as RegistrationIdentityRecord));
      const greenRoomAssignments = greenRoomAssignmentsSnapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
      } as GreenRoomAssignmentIdentityRecord));

      const currentCompetition = competitionSnapshot.data()!;
      const foreignCompetitionIds = Array.from(new Set(
        sourceSnapshots
          .filter(snapshot => snapshot.exists && snapshot.data()?.competitionId !== result.competitionId)
          .map(snapshot => String(snapshot.data()?.competitionId || ''))
          .filter(Boolean)
      ));
      const foreignCompetitionSnapshots = await Promise.all(
        foreignCompetitionIds.map(competitionId => db.collection('competitions').doc(competitionId).get())
      );
      const normalizeIdentity = (value: unknown) =>
        String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
      const duplicateCompetitionIds = new Set<string>();
      foreignCompetitionSnapshots.forEach(snapshot => {
        if (!snapshot.exists) return;
        const candidate = snapshot.data()!;
        const isExactDuplicate =
          normalizeIdentity(candidate.code) === normalizeIdentity(currentCompetition.code) &&
          normalizeIdentity(candidate.name) === normalizeIdentity(currentCompetition.name) &&
          normalizeIdentity(candidate.categoryId) === normalizeIdentity(currentCompetition.categoryId) &&
          normalizeIdentity(candidate.type) === normalizeIdentity(currentCompetition.type);
        if (isExactDuplicate) duplicateCompetitionIds.add(snapshot.id);
      });

      const { ranks: recoveredRanks, remappedRegistrations, recoveredFromGreenRoomAssignments, duplicateRowsRemoved } = recoverResultRankIntegrity({
        competitionId: result.competitionId,
        ranks: rawRanks.map(rank => ({
          rank: rank.rank as 1 | 2 | 3 | null,
          registrationId: String(rank.registrationId),
          bib: typeof rank.bib === 'string' ? rank.bib : '',
          candidateName: typeof rank.candidateName === 'string' ? rank.candidateName : '',
          teamId: typeof rank.teamId === 'string' ? rank.teamId : '',
          teamCode: typeof rank.teamCode === 'string' ? rank.teamCode : '',
          teamName: typeof rank.teamName === 'string' ? rank.teamName : '',
          teamColor: typeof rank.teamColor === 'string' ? rank.teamColor : '#2563EB',
          score: rank.score as number,
          grade: typeof rank.grade === 'string' ? rank.grade as Grade : 'NO_GRADE',
          officialPoints: 0,
          totalEarnedPoints: 0,
          codeLetter: typeof rank.codeLetter === 'string' ? rank.codeLetter : undefined
        })),
        sourceRegistrations: sourceSnapshots.map(snapshot => snapshot.exists
          ? { ...snapshot.data(), id: snapshot.id } as RegistrationIdentityRecord
          : undefined),
        targetRegistrations,
        duplicateCompetitionIds,
        greenRoomAssignments
      });

      const ranks = recoveredRanks.map(rank => {
        const grade = calculateGrade(rank.score, maxMarks);
        const position = rank.rank;
        const points = getChampionshipPoints(result.type, grade as Grade, position);
        return {
          ...rank,
          grade,
          officialPoints: points,
          totalEarnedPoints: points
        };
      });

      await resultRef.update({
        ranks,
        resultStatus: 'READY_TO_PUBLISH',
        marksStatus: 'COMPLETE',
        ...(remappedRegistrations.length > 0 ||
          recoveredFromGreenRoomAssignments.length > 0 ||
          duplicateRowsRemoved > 0 ? {
          integrityRecovery: {
            remappedRegistrations,
            recoveredFromGreenRoomAssignments,
            duplicateRowsRemoved,
            recoveredAt: new Date().toISOString()
          }
        } : {}),
        updatedAt: new Date().toISOString()
      });
      return NextResponse.json({
        success: true,
        ranks,
        recoveredFromGreenRoomAssignments
      }, { status: 200 });
    }

    if (body.action === 'PUBLISH') {
      if (result.resultStatus !== 'READY_TO_PUBLISH') {
        return NextResponse.json({ error: 'Validation Error: Result is not ready for publication.' }, { status: 400 });
      }
      const resultRanks = Array.isArray(result.ranks) ? result.ranks : [];
      const outcome = await PointsLedgerService.publishResultPoints({
        resultId: id,
        competition: {
          id: result.competitionId,
          code: result.competitionCode,
          name: result.competitionName,
          type: result.type
        },
        ranks: resultRanks,
        adminIdToken
      });
      return NextResponse.json(outcome, { status: 200 });
    }

    if (body.action === 'UNPUBLISH') {
      if (result.resultStatus !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Validation Error: Only published results can be unpublished.' }, { status: 400 });
      }
      const success = await PointsLedgerService.reverseResultPoints(
        id,
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim()
          : 'Administrative review',
        adminIdToken
      );
      let resultRecalculated = false;
      if (success && typeof result.competitionId === 'string' && result.competitionId) {
        await JudgeService.refreshResultForCompetition(result.competitionId);
        const refreshedResult = await resultRef.get();
        resultRecalculated = refreshedResult.exists &&
          refreshedResult.data()?.resultStatus === 'READY_FOR_REVIEW';
      }
      return NextResponse.json({ success, resultRecalculated }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Validation Error: action must be CONFIRM, PUBLISH, or UNPUBLISH.' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.toLowerCase().includes('unauthorized') ? 401 :
      message.toLowerCase().includes('validation error') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
