import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { JudgeService } from '@/services/judgeService';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { calculateGrade, getChampionshipPoints, Grade } from '@/domain/scoring';
import { findDuplicateRegistrationGroups } from '@/domain/registrationIntegrity';

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

      const seen = new Set<string>();
      const registrationIdentities: Array<{ id: string; participantId?: string; groupLeaderId?: string; groupMembers?: string[]; participantName?: string; code?: string; teamCode?: string; status?: string }> = [];
      const ranks = await Promise.all(body.ranks.map(async (rank: Record<string, unknown>) => {
        if (
          typeof rank.registrationId !== 'string' ||
          !rank.registrationId ||
          seen.has(rank.registrationId) ||
          typeof rank.score !== 'number' ||
          !Number.isFinite(rank.score) ||
          rank.score < 0 ||
          rank.score > maxMarks ||
          !([1, 2, 3, null].includes(rank.rank as number | null))
        ) {
          throw new Error('Validation Error: Result ranks contain invalid or duplicate entries.');
        }
        seen.add(rank.registrationId);

        const registrationSnapshot = await db.collection('registrations').doc(rank.registrationId).get();
        const registration = registrationSnapshot.data();
        if (
          !registrationSnapshot.exists ||
          registration?.competitionId !== result.competitionId ||
          registration?.status !== 'APPROVED'
        ) {
          throw new Error(`Validation Error: Registration "${rank.registrationId}" is not approved for this competition.`);
        }

        registrationIdentities.push({
          id: registrationSnapshot.id,
          participantId: typeof registration.participantId === 'string' ? registration.participantId : undefined,
          groupLeaderId: typeof registration.groupLeaderId === 'string' ? registration.groupLeaderId : undefined,
          groupMembers: Array.isArray(registration.groupMembers) ? registration.groupMembers.filter((id: unknown): id is string => typeof id === 'string') : [],
          participantName: typeof registration.participantName === 'string' ? registration.participantName : undefined,
          code: typeof registration.code === 'string' ? registration.code : undefined,
          teamCode: typeof registration.teamCode === 'string' ? registration.teamCode : undefined,
          status: typeof registration.status === 'string' ? registration.status : undefined
        });

        const grade = calculateGrade(rank.score, maxMarks);
        const position = rank.rank as 1 | 2 | 3 | null;
        return {
          rank: position,
          registrationId: rank.registrationId,
          bib: registration.chestNumber || '',
          candidateName: registration.participantName || '',
          teamId: registration.teamId || '',
          teamCode: registration.teamCode || '',
          teamName: registration.teamName || '',
          teamColor: rank.teamColor || '#2563EB',
          score: rank.score,
          grade,
          officialPoints: getChampionshipPoints(result.type, grade as Grade, position),
          totalEarnedPoints: getChampionshipPoints(result.type, grade as Grade, position)
        };
      }));

      const duplicateEntrants = findDuplicateRegistrationGroups(
        registrationIdentities,
        result.type === 'GROUP' ? 'GROUP' : 'SOLO'
      );
      if (duplicateEntrants.length > 0) {
        const details = duplicateEntrants.map(group => {
          const records = group.records.map(record =>
            `${record.participantName || record.id} [${record.code || record.id}]`
          );
          return records.join(' / ');
        });
        throw new Error(
          `Duplicate Registration Error: This result contains the same entrant more than once: ${details.join('; ')}. Cancel or reject the extra registration, then refresh the result before confirming.`
        );
      }

      await resultRef.update({
        ranks,
        resultStatus: 'READY_TO_PUBLISH',
        marksStatus: 'COMPLETE',
        updatedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, ranks }, { status: 200 });
    }

    if (body.action === 'PUBLISH') {
      if (result.resultStatus !== 'READY_TO_PUBLISH') {
        return NextResponse.json({ error: 'Validation Error: Result is not ready for publication.' }, { status: 400 });
      }
      const resultRanks = Array.isArray(result.ranks) ? result.ranks : [];
      if (resultRanks.length === 0) {
        throw new Error('Validation Error: A result must contain at least one verified rank before publication.');
      }
      const registrationIds = resultRanks.map((rank: Record<string, unknown>) => rank.registrationId);
      if (registrationIds.some((id: unknown) => typeof id !== 'string' || !id.trim()) ||
          new Set(registrationIds).size !== registrationIds.length) {
        throw new Error('Duplicate Registration Error: The saved result contains missing or repeated registration IDs. Reconfirm the ranks before publishing.');
      }
      const savedRegistrationSnapshots = await Promise.all(
        registrationIds.map((registrationId: string) => db.collection('registrations').doc(registrationId).get())
      );
      const savedRegistrationIdentities = savedRegistrationSnapshots.map((snapshot, index) => {
        const registration = snapshot.data();
        if (!snapshot.exists || registration?.competitionId !== result.competitionId ||
            String(registration?.status || '').trim().toUpperCase() !== 'APPROVED') {
          throw new Error(`Validation Error: Registration "${registrationIds[index]}" is no longer approved for this competition. Reconfirm the result before publishing.`);
        }
        return {
          id: snapshot.id,
          participantId: typeof registration.participantId === 'string' ? registration.participantId : undefined,
          groupLeaderId: typeof registration.groupLeaderId === 'string' ? registration.groupLeaderId : undefined,
          groupMembers: Array.isArray(registration.groupMembers) ? registration.groupMembers.filter((id: unknown): id is string => typeof id === 'string') : [],
          participantName: typeof registration.participantName === 'string' ? registration.participantName : undefined,
          code: typeof registration.code === 'string' ? registration.code : undefined,
          teamCode: typeof registration.teamCode === 'string' ? registration.teamCode : undefined,
          status: typeof registration.status === 'string' ? registration.status : undefined
        };
      });
      const duplicateEntrants = findDuplicateRegistrationGroups(
        savedRegistrationIdentities,
        result.type === 'GROUP' ? 'GROUP' : 'SOLO'
      );
      if (duplicateEntrants.length > 0) {
        const details = duplicateEntrants.map(group =>
          group.records.map(record => `${record.participantName || record.id} [${record.code || record.id}]`).join(' / ')
        );
        throw new Error(
          `Duplicate Registration Error: Publication blocked because the saved result contains repeated entrants: ${details.join('; ')}. Cancel or reject the extra registration, then refresh and reconfirm the result.`
        );
      }

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
