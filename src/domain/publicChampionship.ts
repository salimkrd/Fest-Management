import type { CompetitionResult, ResultRank, Team } from '@/types/fest';

export type ChampionshipDivision = 'SENIOR' | 'GENERAL' | 'SUB_JUNIOR';

export interface DivisionTeamStanding extends Team {
  hasPublishedResults: true;
  pointsComplete: boolean;
  missingPointEntries: number;
}

/**
 * Converts the published category label into the three official championship
 * divisions. "Junior" is accepted only as a legacy alias for "Sub-Junior".
 */
export function getChampionshipDivision(categoryName: string): ChampionshipDivision | null {
  const normalized = (categoryName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (normalized.startsWith('senior')) return 'SENIOR';
  if (normalized.startsWith('general')) return 'GENERAL';
  if (normalized.startsWith('subjunior') || normalized.startsWith('junior')) return 'SUB_JUNIOR';

  return null;
}

/**
 * Reads only a value persisted on the published rank. It deliberately does not
 * invent points from the rank when both the official field and legacy alias
 * are absent.
 */
export function getPublishedOfficialPoints(
  rank: Pick<ResultRank, 'officialPoints' | 'totalEarnedPoints'>
): number | null {
  const officialPoints = rank.officialPoints;
  if (typeof officialPoints === 'number' && Number.isFinite(officialPoints) && officialPoints >= 0) {
    return officialPoints;
  }

  const legacyPoints = rank.totalEarnedPoints;
  if (typeof legacyPoints === 'number' && Number.isFinite(legacyPoints) && legacyPoints >= 0) {
    return legacyPoints;
  }

  return null;
}

/**
 * Builds division-specific team standings exclusively from published results.
 * A team appears only when it has a rank record in that division. Missing
 * persisted point values are flagged; no rank-based fallback is manufactured.
 */
export function buildDivisionTeamStandings(
  teams: Team[],
  results: CompetitionResult[],
  division: ChampionshipDivision
): DivisionTeamStanding[] {
  interface Accumulator {
    totalPoints: number;
    soloPoints: number;
    groupPoints: number;
    firstCount: number;
    secondCount: number;
    thirdCount: number;
    missingPointEntries: number;
  }

  const teamById = new Map(teams.map(team => [team.id, team]));
  const teamsByCode = new Map<string, Team[]>();

  teams.forEach(team => {
    const code = (team.code || '').trim().toUpperCase();
    if (!code) return;
    const matches = teamsByCode.get(code) || [];
    matches.push(team);
    teamsByCode.set(code, matches);
  });

  const accumulators = new Map<string, Accumulator>();

  const resolveTeam = (rank: ResultRank): Team | undefined => {
    if (rank.teamId) {
      const byId = teamById.get(rank.teamId);
      if (byId) return byId;
    }

    const code = (rank.teamCode || '').trim().toUpperCase();
    if (!code) return undefined;
    const matches = teamsByCode.get(code) || [];
    return matches.length === 1 ? matches[0] : undefined;
  };

  results.forEach(result => {
    if (result.resultStatus !== 'PUBLISHED') return;
    if (getChampionshipDivision(result.categoryName) !== division) return;

    result.ranks.forEach(rank => {
      const team = resolveTeam(rank);
      if (!team) return;

      const current = accumulators.get(team.id) || {
        totalPoints: 0,
        soloPoints: 0,
        groupPoints: 0,
        firstCount: 0,
        secondCount: 0,
        thirdCount: 0,
        missingPointEntries: 0
      };

      const points = getPublishedOfficialPoints(rank);
      if (points === null) {
        current.missingPointEntries += 1;
      } else {
        current.totalPoints += points;
        if (result.type === 'GROUP') {
          current.groupPoints += points;
        } else {
          current.soloPoints += points;
        }
      }

      if (rank.rank === 1) current.firstCount += 1;
      if (rank.rank === 2) current.secondCount += 1;
      if (rank.rank === 3) current.thirdCount += 1;

      accumulators.set(team.id, current);
    });
  });

  return teams
    .flatMap(team => {
      const aggregate = accumulators.get(team.id);
      if (!aggregate) return [];

      return [{
        ...team,
        totalPoints: aggregate.totalPoints,
        soloPoints: aggregate.soloPoints,
        groupPoints: aggregate.groupPoints,
        firstCount: aggregate.firstCount,
        secondCount: aggregate.secondCount,
        thirdCount: aggregate.thirdCount,
        hasPublishedResults: true as const,
        pointsComplete: aggregate.missingPointEntries === 0,
        missingPointEntries: aggregate.missingPointEntries
      }];
    })
    .sort((a, b) => {
      if (a.pointsComplete !== b.pointsComplete) return a.pointsComplete ? -1 : 1;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.firstCount !== a.firstCount) return b.firstCount - a.firstCount;
      if (b.secondCount !== a.secondCount) return b.secondCount - a.secondCount;
      if (b.thirdCount !== a.thirdCount) return b.thirdCount - a.thirdCount;
      return a.code.localeCompare(b.code);
    });
}
