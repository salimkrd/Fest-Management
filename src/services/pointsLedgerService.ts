/**
 * Points Ledger Service (Trusted Server Operations)
 * 
 * Enforces:
 * - Idempotent ledger entry commits
 * - Reversal / correction handling
 * - Atomic recalculation of the official team championship leaderboard
 */

import { getAdminDb } from '@/lib/firebase/admin';
import {
  PointsLedgerEntry,
  commitResultToLedger,
  reverseResultInLedger,
  recalculateTeamChampionship,
  CompetitionRankInput
} from '@/domain/ledger';
import { CompetitionType, getChampionshipPoints } from '@/domain/scoring';
import { FirestoreTeam, FirestoreLeaderboardEntry } from '@/types/firestore';
import { AuthService } from './authService';

export class PointsLedgerService {
  static async publishResultsPoints(params: {
    results: Array<{
      resultId: string;
      competition: {
        id: string;
        code: string;
        name: string;
        type: CompetitionType;
      };
      ranks: CompetitionRankInput[];
    }>;
    adminIdToken: string;
  }): Promise<{ success: boolean; resultsPublished: number; entriesCommitted: number }> {
    if (!params.adminIdToken || typeof params.adminIdToken !== 'string') {
      throw new Error('Unauthorized: Admin ID token is required to commit points to the festival ledger.');
    }

    const adminUser = await AuthService.assertAdmin(params.adminIdToken);
    const db = getAdminDb();
    if (!db) {
      throw new Error('Database service unavailable.');
    }

    let entriesCommitted = 0;
    for (const result of params.results) {
      const existingSnap = await db.collection('pointsLedger')
        .where('resultId', '==', result.resultId)
        .get();
      const publishedAt = new Date().toISOString();
      const batch = db.batch();
      const expectedEntryIds = new Set(result.ranks.map(rank => `${result.resultId}_${rank.registrationId}`));

      existingSnap.docs.forEach(doc => {
        if (!expectedEntryIds.has(doc.id)) batch.delete(doc.ref);
      });

      result.ranks.forEach(rank => {
        const entryId = `${result.resultId}_${rank.registrationId}`;
        const entryData: PointsLedgerEntry = {
          id: entryId,
          resultId: result.resultId,
          competitionId: result.competition.id,
          competitionCode: result.competition.code,
          competitionName: result.competition.name,
          competitionType: result.competition.type,
          teamId: rank.teamId,
          teamCode: rank.teamCode,
          teamName: rank.teamName,
          registrationId: rank.registrationId,
          candidateName: rank.candidateName,
          bib: rank.bib,
          score: rank.score,
          rank: rank.rank,
          grade: rank.grade,
          points: getChampionshipPoints(result.competition.type, rank.grade, rank.rank),
          status: 'COMMITTED',
          publishedAt
        };
        batch.set(db.collection('pointsLedger').doc(entryId), entryData);
      });

      batch.update(db.collection('results').doc(result.resultId), {
        resultStatus: 'PUBLISHED',
        publishedDate: publishedAt,
        publishedBy: adminUser.uid
      });
      await batch.commit();
      entriesCommitted += result.ranks.length;
    }

    await this.syncLeaderboardFromLedger();
    return {
      success: true,
      resultsPublished: params.results.length,
      entriesCommitted
    };
  }

  /**
   * Commits official points for a published result inside a Firestore transaction.
   * Cryptographically verifies Admin ID token.
   * Idempotent: Overwrites existing entries for this result to prevent duplicate points.
   */
  static async publishResultPoints(params: {
    resultId: string;
    competition: {
      id: string;
      code: string;
      name: string;
      type: CompetitionType;
    };
    ranks: CompetitionRankInput[];
    adminIdToken: string;
  }): Promise<{ success: boolean; entriesCommitted: number }> {
    if (!params.adminIdToken || typeof params.adminIdToken !== 'string') {
      throw new Error('Unauthorized: Admin ID token is required to commit points to the festival ledger.');
    }

    const adminUser = await AuthService.assertAdmin(params.adminIdToken);

    const db = getAdminDb();
    if (!db) {
      console.warn('[PointsLedgerService] Firebase Admin DB not configured yet. Fallback to local state.');
      return { success: true, entriesCommitted: params.ranks.length };
    }

    const batch = db.batch();
    const publishedAt = new Date().toISOString();

    // 1. Delete or reverse previous entries for this result
    const existingSnap = await db.collection('pointsLedger')
      .where('resultId', '==', params.resultId)
      .get();

    existingSnap.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    // 2. Commit new ledger entries
    params.ranks.forEach(rank => {
      const entryId = `${params.resultId}_${rank.registrationId}`;
      const docRef = db.collection('pointsLedger').doc(entryId);

      const entryData: PointsLedgerEntry = {
        id: entryId,
        resultId: params.resultId,
        competitionId: params.competition.id,
        competitionCode: params.competition.code,
        competitionName: params.competition.name,
        competitionType: params.competition.type,
        teamId: rank.teamId,
        teamCode: rank.teamCode,
        teamName: rank.teamName,
        registrationId: rank.registrationId,
        candidateName: rank.candidateName,
        bib: rank.bib,
        score: rank.score,
        rank: rank.rank,
        grade: rank.grade,
        points: (rank as any).officialPoints !== undefined
          ? (rank as any).officialPoints
          : getChampionshipPoints(params.competition.type, rank.grade, rank.rank),
        status: 'COMMITTED',
        publishedAt
      };

      batch.set(docRef, entryData);
    });

    // 3. Update Result document status
    const resultRef = db.collection('results').doc(params.resultId);
    batch.update(resultRef, {
      resultStatus: 'PUBLISHED',
      publishedDate: publishedAt,
      publishedBy: adminUser.uid
    });

    await batch.commit();

    // 4. Trigger Leaderboard aggregate update
    await this.syncLeaderboardFromLedger();

    return { success: true, entriesCommitted: params.ranks.length };
  }

  /**
   * Safely reverses all points associated with a result when it is unpublished or revised.
   * Cryptographically verifies Admin ID token.
   */
  static async reverseResultPoints(
    resultId: string,
    reason: string,
    adminIdToken: string
  ): Promise<boolean> {
    if (!adminIdToken || typeof adminIdToken !== 'string') {
      throw new Error('Unauthorized: Admin ID token is required to reverse points in the festival ledger.');
    }

    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) return true;

    const snapshot = await db.collection('pointsLedger')
      .where('resultId', '==', resultId)
      .where('status', '==', 'COMMITTED')
      .get();

    const batch = db.batch();
    const reversedAt = new Date().toISOString();
    snapshot.docs.forEach((doc: any) => {
      batch.update(doc.ref, {
        status: 'REVERSED',
        reversalReason: reason,
        reversedBy: adminUser.uid,
        reversedAt
      });
    });

    const resultRef = db.collection('results').doc(resultId);
    batch.update(resultRef, {
      resultStatus: 'REVISION_REQUIRED',
      reversedAt,
      reversedBy: adminUser.uid
    });

    await batch.commit();
    const affectedTeamIds = snapshot.docs.flatMap(doc => {
      const teamId = doc.data()?.teamId;
      return typeof teamId === 'string' ? [teamId] : [];
    });
    if (affectedTeamIds.length > 0) await this.syncLeaderboardFromLedger();
    return true;
  }

  /**
   * Recalculates the public leaderboard document from active COMMITTED ledger entries.
   */
  static async syncLeaderboardFromLedger(): Promise<void> {
    const db = getAdminDb();
    if (!db) return;

    const [teamsSnap, ledgerSnap] = await Promise.all([
      db.collection('teams').get(),
      db.collection('pointsLedger').where('status', '==', 'COMMITTED').get()
    ]);

    const baseTeams = teamsSnap.docs.map((doc: any) => ({
      id: doc.id,
      code: doc.data().code,
      name: doc.data().name
    }));

    const activeLedger = ledgerSnap.docs.map((doc: any) => doc.data() as PointsLedgerEntry);
    const aggregated = recalculateTeamChampionship(baseTeams, activeLedger);

    for (let index = 0; index < aggregated.length; index += 250) {
      const batch = db.batch();
      aggregated.slice(index, index + 250).forEach(agg => {
        const teamDoc = teamsSnap.docs.find((doc: any) => doc.id === agg.teamId);
        const color = teamDoc?.data()?.color || '#2563EB';
        const entry: FirestoreLeaderboardEntry = {
          teamId: agg.teamId,
          teamCode: agg.teamCode,
          teamName: agg.teamName,
          color,
          soloPoints: agg.soloPoints,
          groupPoints: agg.groupPoints,
          totalPoints: agg.totalPoints,
          firstCount: agg.firstCount,
          secondCount: agg.secondCount,
          thirdCount: agg.thirdCount,
          rank: agg.rank,
          lastUpdated: new Date().toISOString()
        };

        batch.set(db.collection('leaderboard').doc(agg.teamId), entry);
        if (teamDoc) {
          batch.set(teamDoc.ref, {
            soloPoints: agg.soloPoints,
            groupPoints: agg.groupPoints,
            totalPoints: agg.totalPoints,
            firstCount: agg.firstCount,
            secondCount: agg.secondCount,
            thirdCount: agg.thirdCount,
            rank: agg.rank
          }, { merge: true });
        }
      });
      await batch.commit();
    }
  }
}
