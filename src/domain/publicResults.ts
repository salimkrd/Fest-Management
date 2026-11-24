import type { ResultRank } from '@/types/fest';

/**
 * Returns every participant awarded a podium position.
 * Tied participants are kept as separate rows; non-prize entries are excluded.
 */
export function getPodiumResultRanks(ranks: readonly ResultRank[]): ResultRank[] {
  return ranks.filter(rank => rank.rank === 1 || rank.rank === 2 || rank.rank === 3);
}
