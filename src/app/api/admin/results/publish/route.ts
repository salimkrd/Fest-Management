import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { getAdminDb } from '@/lib/firebase/admin';
import type { CompetitionRankInput } from '@/domain/ledger';
import type { CompetitionType } from '@/domain/scoring';

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization') || '';
    const adminIdToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!adminIdToken) {
      return NextResponse.json({ error: 'Unauthorized: Missing administrator authentication token.' }, { status: 401 });
    }

    const body: unknown = await req.json();
    const resultIds =
      body && typeof body === 'object' && 'resultIds' in body ? body.resultIds : undefined;
    if (
      !Array.isArray(resultIds) ||
      resultIds.length === 0 ||
      resultIds.length > 100 ||
      resultIds.some((id: unknown) => typeof id !== 'string' || !id.trim()) ||
      new Set(resultIds).size !== resultIds.length
    ) {
      return NextResponse.json({ error: 'Validation Error: Provide 1–100 unique result IDs.' }, { status: 400 });
    }

    await AuthService.assertAdmin(adminIdToken);
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 });
    }

    const ids = resultIds as string[];
    const snapshots = await Promise.all(ids.map(id => db.collection('results').doc(id).get()));
    const results = snapshots.map((snapshot, index) => {
      if (!snapshot.exists) throw new Error(`Validation Error: Result "${ids[index]}" was not found.`);
      const result = snapshot.data()!;
      if (!['READY_TO_PUBLISH', 'READY_FOR_REVIEW'].includes(result.resultStatus)) {
        throw new Error(`Validation Error: Result "${snapshot.id}" is not ready for publication.`);
      }
      if (!Array.isArray(result.ranks) || !result.competitionId || !['SOLO', 'GROUP'].includes(result.type)) {
        throw new Error(`Validation Error: Result "${snapshot.id}" is incomplete.`);
      }
      return {
        resultId: snapshot.id,
        competition: {
          id: result.competitionId as string,
          code: result.competitionCode || '',
          name: result.competitionName || '',
          type: result.type as CompetitionType
        },
        ranks: result.ranks as CompetitionRankInput[]
      };
    });

    const outcome = await PointsLedgerService.publishResultsPoints({ results, adminIdToken });
    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.toLowerCase().includes('unauthorized') ? 401 :
      message.toLowerCase().includes('validation error') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
