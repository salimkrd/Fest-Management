import { describe, expect, it } from 'vitest';
import type { CompetitionResult, Participant, Registration, ResultRank } from '@/types/fest';
import { buildParticipantAchievements } from '../participantAchievements';

const participant = (id: string, bib: string, name: string): Participant => ({
  id, bib, name, place: '', email: '', phone: '',
  teamId: 'team-1', teamCode: 'QHR', teamName: 'Qahira',
  categoryId: 'cat-1', categoryName: 'Senior', classGrade: '',
  dob: '', photoUrl: '', registeredEventIds: [], idStatus: 'GENERATED'
});

const registration = ({ id, ...overrides }: Partial<Registration> & Pick<Registration, 'id'>): Registration => ({
  id, code: 'REG-1', participantName: 'Participant',
  teamId: 'team-1', teamCode: 'QHR', teamName: 'Qahira',
  categoryId: 'cat-1', categoryName: 'Senior', competitionId: 'comp-1',
  competitionName: 'Competition', type: 'SOLO', chestNumber: '#1001',
  status: 'APPROVED', registeredAt: '2026-11-26T00:00:00.000Z', ...overrides
});

const rank = (registrationId: string, bib: string, candidateName: string, position: 1 | 2 | 3 | null): ResultRank => ({
  registrationId, bib, candidateName, rank: position,
  teamId: 'team-1', teamCode: 'QHR', teamName: 'Qahira', teamColor: '#86152C',
  score: 90, grade: 'A', officialPoints: 10, totalEarnedPoints: 10
});

const result = (
  id: string, ranks: ResultRank[],
  resultStatus: CompetitionResult['resultStatus'] = 'PUBLISHED',
  type: CompetitionResult['type'] = 'SOLO'
): CompetitionResult => ({
  id, competitionId: 'comp-' + id, competitionCode: id.toUpperCase(),
  competitionName: 'Competition ' + id, categoryName: 'Senior', type,
  stageName: 'Main Stage', marksStatus: 'COMPLETE', resultStatus, ranks, posterReleased: false
});

describe('buildParticipantAchievements', () => {
  it('counts published podium positions and ignores drafts and non-podium ranks', () => {
    const people = [participant('p1', '#1001', 'Amina'), participant('p2', '#1002', 'Hafiz')];
    const regs = [registration({ id: 'r1', participantId: 'p1' }), registration({ id: 'r2', participantId: 'p2', chestNumber: '#1002' })];
    const rows = buildParticipantAchievements(people, regs, [
      result('one', [rank('r1', '#1001', 'Amina', 1), rank('r2', '#1002', 'Hafiz', 2)]),
      result('two', [rank('r1', '#1001', 'Amina', 3)]),
      result('draft', [rank('r2', '#1002', 'Hafiz', 1)], 'READY_TO_PUBLISH'),
      result('none', [rank('r1', '#1001', 'Amina', null)])
    ]);
    expect(rows.find(row => row.participant.id === 'p1')).toMatchObject({ firstCount: 1, secondCount: 0, thirdCount: 1, totalAwards: 2 });
    expect(rows.find(row => row.participant.id === 'p2')).toMatchObject({ firstCount: 0, secondCount: 1, thirdCount: 0, totalAwards: 1 });
  });

  it('counts tied positions for every distinct participant', () => {
    const people = [participant('p1', '#1001', 'Amina'), participant('p2', '#1002', 'Hafiz')];
    const regs = [registration({ id: 'r1', participantId: 'p1' }), registration({ id: 'r2', participantId: 'p2' })];
    const rows = buildParticipantAchievements(people, regs, [
      result('tie', [rank('r1', '#1001', 'Amina', 1), rank('r2', '#1002', 'Hafiz', 1)])
    ]);
    expect(rows.map(row => row.firstCount)).toEqual([1, 1]);
  });

  it('credits group events to the leader and legacy stored group members', () => {
    const people = [participant('leader', '#1001', 'Amina'), participant('member', '#1002', 'Hafiz')];
    const regs = [
      registration({ id: 'new-group', type: 'GROUP', groupLeaderId: 'leader', participantName: 'Amina & Team' }),
      registration({ id: 'legacy-group', type: 'GROUP', groupMembers: ['leader', 'member'], participantName: 'Amina & Team' })
    ];
    const rows = buildParticipantAchievements(people, regs, [
      result('group1', [rank('new-group', 'GRP-QHR-A1', 'Amina & Team', 1)], 'PUBLISHED', 'GROUP'),
      result('group2', [rank('legacy-group', 'GRP-QHR-A2', 'Amina & Team', 2)], 'PUBLISHED', 'GROUP')
    ]);
    expect(rows.find(row => row.participant.id === 'leader')).toMatchObject({ firstCount: 1, secondCount: 1, totalAwards: 2 });
    expect(rows.find(row => row.participant.id === 'member')).toMatchObject({ firstCount: 0, secondCount: 1, totalAwards: 1 });
  });

  it('uses unique bib/team/name fallback when a historical registration is missing', () => {
    const people = [participant('p1', '#1001', 'Amina'), participant('p2', '#1002', 'Hafiz')];
    const rows = buildParticipantAchievements(people, [], [
      result('restored', [rank('deleted-registration', '1001', 'Amina', 1)])
    ]);
    expect(rows.find(row => row.participant.id === 'p1')?.firstCount).toBe(1);
    expect(rows.find(row => row.participant.id === 'p2')?.firstCount).toBe(0);
  });

  it('keeps participants with no podium positions in the report', () => {
    const rows = buildParticipantAchievements([participant('p1', '#1001', 'Amina')], [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalAwards).toBe(0);
  });
});
