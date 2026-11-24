import { describe, expect, it } from 'vitest';
import type { ResultRank } from '@/types/fest';
import { formatPublicPodiumSummary, getPodiumResultRanks } from '../publicResults';

const rank = (registrationId: string, position: 1 | 2 | 3 | null): ResultRank => ({
  registrationId,
  rank: position,
  bib: registrationId,
  candidateName: registrationId,
  teamId: 'team-1',
  teamCode: 'QHR',
  teamName: 'Qahira',
  teamColor: '#86152C',
  score: 80,
  grade: 'A',
  officialPoints: 10,
  totalEarnedPoints: 10
});

describe('getPodiumResultRanks', () => {
  it('keeps every recipient of tied 1st, 2nd and 3rd positions', () => {
    const podium = getPodiumResultRanks([
      rank('winner', 1),
      rank('second-a', 2),
      rank('second-b', 2),
      rank('third', 3),
      rank('no-prize', null)
    ]);

    expect(podium.map(entry => [entry.registrationId, entry.rank])).toEqual([
      ['winner', 1],
      ['second-a', 2],
      ['second-b', 2],
      ['third', 3]
    ]);
  });

  it('returns an empty list when there are no podium recipients', () => {
    expect(getPodiumResultRanks([rank('participant', null)])).toEqual([]);
  });
});


describe('formatPublicPodiumSummary', () => {
  it('includes every tied podium recipient in the share message', () => {
    expect(formatPublicPodiumSummary([
      rank('winner', 1),
      rank('second-a', 2),
      rank('second-b', 2),
      rank('third', 3),
      rank('no-prize', null)
    ])).toBe([
      '🥇 1st Place: winner (QHR)',
      '🥈 2nd Place: second-a (QHR)',
      '🥈 2nd Place: second-b (QHR)',
      '🥉 3rd Place: third (QHR)'
    ].join('\\n'));
  });
});
