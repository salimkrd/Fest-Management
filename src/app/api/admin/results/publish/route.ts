import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { PointsLedgerService } from '@/services/pointsLedgerService';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import type { CompetitionRankInput } from '@/domain/ledger';
import { findDuplicateRegistrationGroups } from '@/domain/registrationIntegrity';
import type { CompetitionType } from '@/domain/scoring';

export async function POST(req: NextRequest) {
  try {
    await syncWorkloadIdentityToken();
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
      const ranks = result.ranks as CompetitionRankInput[];
      const registrationIds = ranks.map(rank => rank.registrationId);
      if (registrationIds.some(id => typeof id !== 'string' || !id.trim()) ||
          new Set(registrationIds).size !== registrationIds.length) {
        throw new Error(`Duplicate Registration Error: Result "${snapshot.id}" contains missing or repeated registration IDs. Reconfirm the ranks before publishing.`);
      }
      return {
        resultId: snapshot.id,
        competition: {
          id: result.competitionId as string,
          code: result.competitionCode || '',
          name: result.competitionName || '',
          type: result.type as CompetitionType
        },
        ranks
      };
    });

    for (const result of results) {
      const registrationSnapshots = await Promise.all(
        result.ranks.map(rank => db.collection('registrations').doc(rank.registrationId).get())
      );
      const identities = registrationSnapshots.map((registrationSnapshot, index) => {
        const registration = registrationSnapshot.data();
        if (!registrationSnapshot.exists ||
            registration?.competitionId !== result.competition.id ||
            String(registration?.status || '').trim().toUpperCase() !== 'APPROVED') {
          throw new Error(`Validation Error: Registration "${result.ranks[index].registrationId}" is no longer approved for "${result.competition.name}". Reconfirm the result before publishing.`);
        }
        return {
          id: registrationSnapshot.id,
          participantId: typeof registration.participantId === 'string' ? registration.participantId : undefined,
          groupLeaderId: typeof registration.groupLeaderId === 'string' ? registration.groupLeaderId : undefined,
          groupMembers: Array.isArray(registration.groupMembers) ? registration.groupMembers.filter((id: unknown): id is string => typeof id === 'string') : [],
          participantName: typeof registration.participantName === 'string' ? registration.participantName : undefined,
          code: typeof registration.code === 'string' ? registration.code : undefined,
          teamCode: typeof registration.teamCode === 'string' ? registration.teamCode : undefined,
          status: typeof registration.status === 'string' ? registration.status : undefined
        };
      });
      const duplicates = findDuplicateRegistrationGroups(identities, result.competition.type);
      if (duplicates.length > 0) {
        const details = duplicates.map(group =>
          group.records.map(record => `${record.participantName || record.id} [${record.code || record.id}]`).join(' / ')
        );
        throw new Error(
          `Duplicate Registration Error: "${result.competition.name}" has repeated entrants: ${details.join('; ')}. Cancel or reject the extra registration, then refresh and reconfirm the result.`
        );
      }
    }

    const outcome = await PointsLedgerService.publishResultsPoints({ results, adminIdToken });
    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.toLowerCase().includes('unauthorized') ? 401 :
      message.toLowerCase().includes('validation error') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
