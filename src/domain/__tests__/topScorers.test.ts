import { describe, expect, it } from 'vitest';
import { calculateTopScorers } from '../topScorers';
import type { Competition, CompetitionResult, Participant, Registration } from '@/types/fest';

const competition = (id: string, performanceMode?: 'STAGE' | 'OFF_STAGE', type: 'SOLO' | 'GROUP' = 'SOLO', maxMarks = 100) =>
  ({ id, type, performanceMode, criteria: [{ id: 'marks', name: 'Marks', maxMarks }] } as Competition);
const participant = (id: string) =>
  ({ id, name: id, bib: id, teamId: 't1', teamName: 'Team One', teamCode: 'T1', categoryName: 'Senior' } as Participant);
const registration = (id: string, competitionId: string, participantId: string, type: 'SOLO' | 'GROUP' = 'SOLO') =>
  ({ id, competitionId, participantId, teamId: 't1', status: 'APPROVED', type } as Registration);
const result = (id: string, competitionId: string, registrationId: string, score: number,
  type: 'SOLO' | 'GROUP' = 'SOLO', resultStatus: 'PUBLISHED' | 'REVISION_REQUIRED' = 'PUBLISHED') =>
  ({ id, competitionId, type, resultStatus,
    ranks: [{ registrationId, score }] } as CompetitionResult);

describe('Star of the Fest / Pen of the Fest scorer calculation', () => {
  it('segregates stage and off-stage results', () => {
    const events = [competition('stage', 'STAGE'), competition('off', 'OFF_STAGE')];
    const regs = [registration('r1', 'stage', 'a'), registration('r2', 'off', 'b')];
    const results = [result('res1', 'stage', 'r1', 80), result('res2', 'off', 'r2', 99)];
    const people = [participant('a'), participant('b')];
    expect(calculateTopScorers('STAGE', events, results, regs, people).map(x => x.participantId)).toEqual(['a']);
    expect(calculateTopScorers('OFF_STAGE', events, results, regs, people).map(x => x.participantId)).toEqual(['b']);
  });

  it('excludes group marks, unpublished results and unclassified competitions', () => {
    const events = [competition('solo', 'STAGE'), competition('group', 'STAGE', 'GROUP'),
      competition('unpub', 'STAGE'), competition('legacy')];
    const regs = [
      registration('r1', 'solo', 'a'), registration('r2', 'group', 'a', 'GROUP'),
      registration('r3', 'unpub', 'b'), registration('r4', 'legacy', 'b')
    ];
    const results = [result('res1', 'solo', 'r1', 65), result('res2', 'group', 'r2', 100, 'GROUP'),
      result('res3', 'unpub', 'r3', 100, 'SOLO', 'REVISION_REQUIRED'),
      result('res4', 'legacy', 'r4', 100)];
    const ranking = calculateTopScorers('STAGE', events, results, regs, [participant('a'), participant('b')]);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].totalMarks).toBe(65);
  });

  it('normalizes varying maxima, sums multiple events and handles three-way ties', () => {
    const events = [competition('e1', 'OFF_STAGE', 'SOLO', 80),
      competition('e2', 'OFF_STAGE')];
    const regs = [registration('r1', 'e1', 'a'), registration('r2', 'e1', 'b'),
      registration('r3', 'e1', 'c'), registration('r4', 'e2', 'a')];
    const results = [
      { ...result('res1', 'e1', 'r1', 80),
        ranks: [{ registrationId: 'r1', score: 80 }, { registrationId: 'r2', score: 80 },
          { registrationId: 'r3', score: 80 }] },
      result('res2', 'e2', 'r4', 90)
    ] as CompetitionResult[];
    const ranking = calculateTopScorers('OFF_STAGE', events, results, regs, [participant('a'), participant('b'), participant('c')]);
    expect(ranking[0]).toMatchObject({ participantId: 'a', totalMarks: 190, competitionsCount: 2, position: 1 });
    expect(ranking.slice(1).map(x => x.position)).toEqual([2, 2]);
    const oneEvent = calculateTopScorers('OFF_STAGE', [events[0]], [results[0]], regs, [participant('a'), participant('b'), participant('c')]);
    expect(oneEvent.map(x => x.position)).toEqual([1, 1, 1]);
  });

  it('deduplicates duplicate result ranks and rejects invalid scores', () => {
    const events = [competition('e', 'STAGE')];
    const regs = [registration('r', 'e', 'a')];
    const duplicated = { ...result('res', 'e', 'r', 70),
      ranks: [{ registrationId: 'r', score: 70 }, { registrationId: 'r', score: 70 }] } as CompetitionResult;
    expect(calculateTopScorers('STAGE', events, [duplicated], regs, [participant('a')])[0].totalMarks).toBe(70);
    expect(calculateTopScorers('STAGE', events, [result('res', 'e', 'r', 110)], regs, [participant('a')])).toEqual([]);
  });
});
