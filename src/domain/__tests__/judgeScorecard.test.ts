import { describe, expect, it } from 'vitest';
import { buildAdminJudgeScorecard } from '@/domain/judgeScorecard';
import { buildGreenRoomRosterSnapshot } from '@/domain/greenRoomRoster';

const competition = {
  id: 'cmp-1',
  code: 'CMP-01',
  name: 'Speech',
  maxMarks: 100,
  criteria: [
    { id: 'voice', name: 'Voice', maxMarks: 40 },
    { id: 'content', name: 'Content', maxMarks: 60 }
  ]
};
const assignment = {
  id: 'asgn-1',
  competitionId: 'cmp-1',
  judgeName: 'Judge One',
  status: 'SUBMITTED'
};
const rosterDocuments = [
  {
    id: 'cmp-1_reg-1',
    data: {
      competitionId: 'cmp-1', registrationId: 'reg-1', codeLetter: 'A', codeIndex: 0,
      participantId: 'part-1', participantNameSnapshot: 'Private Student One',
      teamId: 'team-1', teamCode: 'T1', teamName: 'Team One', chestNumber: '101',
      groupMembers: [], groupLeaderId: '', groupSize: null
    }
  },
  {
    id: 'cmp-1_reg-2',
    data: {
      competitionId: 'cmp-1', registrationId: 'reg-2', codeLetter: 'B', codeIndex: 1,
      participantId: 'part-2', participantNameSnapshot: 'Private Student Two',
      teamId: 'team-2', teamCode: 'T2', teamName: 'Team Two', chestNumber: '102',
      groupMembers: [], groupLeaderId: '', groupSize: null
    }
  }
];

describe('Admin judge scorecard Code Letter resolution', () => {
  it('maps submitted scores using the immutable archived Code Letter snapshot', () => {
    const result = buildAdminJudgeScorecard({
      assignment,
      competition,
      markData: {
        assignmentId: 'asgn-1',
        competitionId: 'cmp-1',
        status: 'SUBMITTED',
        scores: {
          'reg-1': { voice: 30, content: 50 },
          'reg-2': { voice: 35, content: 55 }
        },
        anonymousRoster: [
          { codeLetter: 'A', codeIndex: 0 },
          { codeLetter: 'B', codeIndex: 1 }
        ],
        codeRegistrationSnapshot: [
          { registrationId: 'reg-1', codeLetter: 'A', codeIndex: 0 },
          { registrationId: 'reg-2', codeLetter: 'B', codeIndex: 1 }
        ]
      }
    });

    expect(result.rows).toEqual([
      { codeLetter: 'A', codeIndex: 0, criterionMarks: { voice: 30, content: 50 }, totalMarks: 80 },
      { codeLetter: 'B', codeIndex: 1, criterionMarks: { voice: 35, content: 55 }, totalMarks: 90 }
    ]);
    expect(JSON.stringify(result)).not.toContain('reg-1');
    expect(JSON.stringify(result)).not.toContain('Private Student');
    expect(JSON.stringify(result)).not.toContain('101');
  });

  it('uses the archived mapping even when the current Green Room mapping later changes', () => {
    const result = buildAdminJudgeScorecard({
      assignment,
      competition,
      markData: {
        assignmentId: 'asgn-1', competitionId: 'cmp-1', status: 'SUBMITTED',
        scores: { 'reg-1': { voice: 30, content: 50 } },
        anonymousRoster: [{ codeLetter: 'A', codeIndex: 0 }],
        codeRegistrationSnapshot: [{ registrationId: 'reg-1', codeLetter: 'A', codeIndex: 0 }]
      },
      greenRoomDocuments: [rosterDocuments[1]]
    });
    expect(result.rows[0]).toMatchObject({ codeLetter: 'A', totalMarks: 80 });
  });

  it('maps a draft only when its saved roster version still matches the live Code Letter roster', () => {
    const roster = buildGreenRoomRosterSnapshot('cmp-1', rosterDocuments);
    const result = buildAdminJudgeScorecard({
      assignment: { ...assignment, status: 'IN_PROGRESS' },
      competition,
      greenRoomDocuments: rosterDocuments,
      markData: {
        assignmentId: 'asgn-1', competitionId: 'cmp-1', status: 'DRAFT',
        rosterVersion: roster.version,
        scores: { 'reg-1': { voice: 20 }, 'reg-2': { content: 40 } }
      }
    });
    expect(result.markStatus).toBe('DRAFT');
    expect(result.rows).toEqual([
      { codeLetter: 'A', codeIndex: 0, criterionMarks: { voice: 20, content: null }, totalMarks: 20 },
      { codeLetter: 'B', codeIndex: 1, criterionMarks: { content: 40, voice: null }, totalMarks: 40 }
    ]);
  });

  it('fails closed when a draft roster changed after the scorecard was saved', () => {
    const roster = buildGreenRoomRosterSnapshot('cmp-1', rosterDocuments);
    const changed = rosterDocuments.map(item => ({
      ...item,
      data: { ...item.data, codeLetter: item.data.codeLetter === 'A' ? 'B' : 'A', codeIndex: item.data.codeIndex === 0 ? 1 : 0 }
    }));
    expect(() => buildAdminJudgeScorecard({
      assignment,
      competition,
      greenRoomDocuments: changed,
      markData: {
        assignmentId: 'asgn-1', competitionId: 'cmp-1', status: 'DRAFT',
        rosterVersion: roster.version,
        scores: { 'reg-1': { voice: 20 } }
      }
    })).toThrow(/roster changed/);
  });

  it('fails closed for submitted scorecards with missing or inconsistent archived mapping', () => {
    expect(() => buildAdminJudgeScorecard({
      assignment, competition,
      markData: {
        assignmentId: 'asgn-1', competitionId: 'cmp-1', status: 'SUBMITTED',
        scores: { 'reg-1': 80 },
        anonymousRoster: [{ codeLetter: 'A', codeIndex: 0 }],
        codeRegistrationSnapshot: []
      }
    })).toThrow(/archived Code Letter mapping/);
  });

  it('shows a not-started assignment without inventing score rows', () => {
    const result = buildAdminJudgeScorecard({
      assignment: { ...assignment, status: 'NOT_STARTED' },
      competition,
      markData: null
    });
    expect(result.markStatus).toBe('NOT_STARTED');
    expect(result.rows).toEqual([]);
  });

  it('accepts legacy total-number marks and labels them as totals', () => {
    const result = buildAdminJudgeScorecard({
      assignment, competition,
      markData: {
        assignmentId: 'asgn-1', competitionId: 'cmp-1', status: 'SUBMITTED',
        scores: { 'reg-1': 77 },
        anonymousRoster: [{ codeLetter: 'A', codeIndex: 0 }],
        codeRegistrationSnapshot: [{ registrationId: 'reg-1', codeLetter: 'A', codeIndex: 0 }]
      }
    });
    expect(result.rows[0]).toMatchObject({ codeLetter: 'A', totalMarks: 77 });
  });
});
