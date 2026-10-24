import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { getAdminDb } from '@/lib/firebase/admin';
import { calculateGrade, getChampionshipPoints, Grade } from '@/domain/scoring';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      const competition = competitionSnapshot.data();
      const criteria = Array.isArray(competition?.criteria) ? competition.criteria : [];
      const maxMarks = Number(competition?.maxMarks) ||
        (criteria.length
          ? criteria.reduce((total: number, criterion: { maxMarks?: number }) => total + Number(criterion.maxMarks || 0), 0)
          : 100);
      if (maxMarks <= 0) {
        return NextResponse.json({ error: 'Validation Error: Competition maximum marks must be positive.' }, { status: 400 });
      }

      const seen = new Set<string>();
      const ranks = await Promise.all(body.ranks.map(async (rank: Record<string, unknown>) => {
        if (
          typeof rank.registrationId !== 'string' ||
          !rank.registrationId ||
          seen.has(rank.registrationId) ||
          typeof rank.score !== 'number' ||
          !Number.isFinite(rank.score) ||
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
      return NextResponse.json({ success }, { status: 200 });
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
