/**
 * Championship Points Ledger & Tabulation Domain Engine
 * 
 * Provides an idempotent, verifiable transaction ledger for official festival points.
 * Ensures:
 * - Team points ONLY update upon official result publication by Admin.
 * - Idempotency: Re-publishing or retrying does not duplicate points.
 * - Corrections/Unpublishing safely reverse previous ledger entries.
 * - Single award for group competitions.
 */

import {
  Grade,
  PrizePosition,
  CompetitionType,
  getChampionshipPoints,
  normalizePosition
} from './scoring';

export type ResultStatus =
  | 'DRAFT'
  | 'AWAITING_MARKS'
  | 'READY_FOR_REVIEW'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'REVISION_REQUIRED';

export interface PointsLedgerEntry {
  id: string; // Deterministic: `${resultId}_${registrationId}`
  resultId: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  competitionType: CompetitionType;
  teamId: string;
  teamCode: string;
  teamName: string;
  registrationId: string;
  candidateName: string;
  bib: string;
  score: number;
  rank: 1 | 2 | 3 | null;
  grade: Grade;
  points: number;
  status: 'COMMITTED' | 'REVERSED';
  publishedAt: string;
  reversalReason?: string;
}

export interface CompetitionRankInput {
  registrationId: string;
  bib: string;
  candidateName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  score: number;
  rank: 1 | 2 | 3 | null;
  grade: Grade;
}

export interface TeamAggregatePoints {
  teamId: string;
  teamCode: string;
  teamName: string;
  totalPoints: number;
  soloPoints: number;
  groupPoints: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
  rank: number;
}

/**
 * Creates deterministic ledger transaction ID.
 */
export function generateLedgerEntryId(resultId: string, registrationId: string): string {
  return `${resultId}_${registrationId}`;
}

/**
 * Commits official points for a published result into the ledger.
 * This operation is IDEMPOTENT. Any previous entries for this result are reversed/replaced.
 */
export function commitResultToLedger(
  resultId: string,
  competition: {
    id: string;
    code: string;
    name: string;
    type: CompetitionType;
  },
  ranks: CompetitionRankInput[],
  existingLedger: PointsLedgerEntry[],
  publishedAt: string = new Date().toISOString()
): PointsLedgerEntry[] {
  // 1. Mark any existing entries for this result as REVERSED
  const nonConflictingLedger = existingLedger.filter(entry => entry.resultId !== resultId);

  // 2. Generate new committed entries
  const newEntries: PointsLedgerEntry[] = ranks.map(rank => {
    const points = getChampionshipPoints(competition.type, rank.grade, rank.rank);

    return {
      id: generateLedgerEntryId(resultId, rank.registrationId),
      resultId,
      competitionId: competition.id,
      competitionCode: competition.code,
      competitionName: competition.name,
      competitionType: competition.type,
      teamId: rank.teamId,
      teamCode: rank.teamCode,
      teamName: rank.teamName,
      registrationId: rank.registrationId,
      candidateName: rank.candidateName,
      bib: rank.bib,
      score: rank.score,
      rank: rank.rank,
      grade: rank.grade,
      points,
      status: 'COMMITTED',
      publishedAt
    };
  });

  return [...nonConflictingLedger, ...newEntries];
}

/**
 * Safely reverses all points associated with a result (e.g. unpublishing or revision).
 */
export function reverseResultInLedger(
  resultId: string,
  existingLedger: PointsLedgerEntry[],
  reason: string = 'Admin requested result revision'
): PointsLedgerEntry[] {
  return existingLedger.map(entry => {
    if (entry.resultId === resultId && entry.status === 'COMMITTED') {
      return {
        ...entry,
        status: 'REVERSED',
        reversalReason: reason
      };
    }
    return entry;
  });
}

/**
 * Recalculates team totals purely from active COMMITTED ledger entries.
 * Preserves baseline team identities and sorts by totalPoints descending.
 */
export function recalculateTeamChampionship(
  baseTeams: Array<{ id: string; code: string; name: string }>,
  ledger: PointsLedgerEntry[]
): TeamAggregatePoints[] {
  // Initialize accumulator
  const teamMap: Record<string, TeamAggregatePoints> = {};
  baseTeams.forEach(t => {
    teamMap[t.id] = {
      teamId: t.id,
      teamCode: t.code,
      teamName: t.name,
      totalPoints: 0,
      soloPoints: 0,
      groupPoints: 0,
      firstCount: 0,
      secondCount: 0,
      thirdCount: 0,
      rank: 1
    };
  });

  // Tally all COMMITTED ledger entries
  ledger.forEach(entry => {
    if (entry.status !== 'COMMITTED') return;

    if (!teamMap[entry.teamId]) {
      teamMap[entry.teamId] = {
        teamId: entry.teamId,
        teamCode: entry.teamCode,
        teamName: entry.teamName,
        totalPoints: 0,
        soloPoints: 0,
        groupPoints: 0,
        firstCount: 0,
        secondCount: 0,
        thirdCount: 0,
        rank: 1
      };
    }

    const t = teamMap[entry.teamId];
    t.totalPoints += entry.points;

    if (entry.competitionType === 'GROUP') {
      t.groupPoints += entry.points;
    } else {
      t.soloPoints += entry.points;
    }

    if (entry.rank === 1) t.firstCount += 1;
    if (entry.rank === 2) t.secondCount += 1;
    if (entry.rank === 3) t.thirdCount += 1;
  });

  // Convert to array and assign ranks
  const teamList = Object.values(teamMap);
  teamList.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // Secondary tie-break: number of 1st places
    if (b.firstCount !== a.firstCount) {
      return b.firstCount - a.firstCount;
    }
    // Tertiary tie-break: number of 2nd places
    return b.secondCount - a.secondCount;
  });

  // Assign rankings (handling true ties by sharing rank)
  let currentRank = 1;
  for (let i = 0; i < teamList.length; i++) {
    if (i > 0) {
      const prev = teamList[i - 1];
      const curr = teamList[i];
      if (curr.totalPoints === prev.totalPoints && curr.firstCount === prev.firstCount) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    } else {
      teamList[0].rank = 1;
    }
  }

  return teamList;
}
