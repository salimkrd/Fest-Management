import type { ResultRank } from '@/types/fest';

/**
 * Returns every participant awarded a podium position.
 * Tied participants are kept as separate rows; non-prize entries are excluded.
 */
export function getPodiumResultRanks(ranks: readonly ResultRank[]): ResultRank[] {
  return ranks.filter(rank => rank.rank === 1 || rank.rank === 2 || rank.rank === 3);
}


/**
 * Formats every podium recipient for the public result share message.
 * Tied participants remain separate lines, in official result order.
 */
export function formatPublicPodiumSummary(ranks: readonly ResultRank[]): string {
  const medals: Record<1 | 2 | 3, string> = {
    1: '🥇 1st Place',
    2: '🥈 2nd Place',
    3: '🥉 3rd Place'
  };

  return getPodiumResultRanks(ranks)
    .map(rank => `${medals[rank.rank as 1 | 2 | 3]}: ${rank.candidateName} (${rank.teamCode})`)
    .join('\\n');
}
