import { describe, expect, it } from 'vitest';
import type { ResultRank } from '@/types/fest';
import {
  recoverResultRankIntegrity,
  type GreenRoomAssignmentIdentityRecord,
  type RegistrationIdentityRecord
} from '../resultRankIntegrity';

const makeRank = (overrides: Partial<ResultRank> = {}): ResultRank => ({
  rank: 1,
  registrationId: 'reg-old',
  bib: '1042',
  candidateName: 'Aisha',
  teamId: 'team-1',
  teamCode: 'T1',
  teamName: 'Team One',
  teamColor: '#2563EB',
  score: 95,
  grade: 'A+',
  officialPoints: 11,
  totalEarnedPoints: 11,
  ...overrides
});

const registration = (
  overrides: Partial<RegistrationIdentityRecord> = {}
): RegistrationIdentityRecord => ({
  id: 'reg-canonical',
  competitionId: 'cmp-main',
  status: 'APPROVED',
  participantId: 'participant-1',
  participantName: 'Aisha',
  teamId: 'team-1',
  teamCode: 'T1',
  teamName: 'Team One',
  chestNumber: '1042',
  ...overrides
});

const greenRoomAssignment = (
  overrides: Partial<GreenRoomAssignmentIdentityRecord> = {}
): GreenRoomAssignmentIdentityRecord => ({
  id: 'cmp-main_reg-old',
  competitionId: 'cmp-main',
  registrationId: 'reg-old',
  participantName: 'Aisha',
  participantNameSnapshot: 'Aisha',
  teamId: 'team-1',
  teamCode: 'T1',
  teamName: 'Team One',
  chestNumber: '1042',
  codeLetter: 'B',
  ...overrides
});

describe('recoverResultRankIntegrity', () => {
  it('remaps an entrant from an exact duplicate competition to the approved registration', () => {
    const source = registration({ id: 'reg-old', competitionId: 'cmp-duplicate' });
    const target = registration();

    const result = recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [target],
      duplicateCompetitionIds: new Set(['cmp-duplicate'])
    });

    expect(result.ranks[0].registrationId).toBe('reg-canonical');
    expect(result.ranks[0].candidateName).toBe('Aisha');
    expect(result.remappedRegistrations).toEqual([
      { fromRegistrationId: 'reg-old', toRegistrationId: 'reg-canonical' }
    ]);
    expect(result.duplicateRowsRemoved).toBe(0);
  });

  it('maps a non-approved duplicate registration to the one approved entry for the same participant', () => {
    const source = registration({ id: 'reg-old', status: 'CANCELLED' });
    const target = registration();

    const result = recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [target],
      duplicateCompetitionIds: new Set()
    });

    expect(result.ranks[0].registrationId).toBe('reg-canonical');
  });

  it('uses the frozen Green Room assignment when registration was deleted after Code Letter assignment', () => {
    const assignment = greenRoomAssignment();
    const result = recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [undefined],
      targetRegistrations: [],
      duplicateCompetitionIds: new Set(),
      greenRoomAssignments: [assignment]
    });

    expect(result.ranks[0].registrationId).toBe('reg-old');
    expect(result.ranks[0].candidateName).toBe('Aisha');
    expect(result.ranks[0].codeLetter).toBe('B');
    expect(result.recoveredFromGreenRoomAssignments).toEqual([{
      registrationId: 'reg-old',
      codeLetter: 'B',
      candidateName: 'Aisha',
      bib: '1042'
    }]);
  });

  it('uses a same-competition Code Letter snapshot if source registration now belongs to another competition', () => {
    const source = registration({ id: 'reg-old', competitionId: 'cmp-unrelated' });
    const result = recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [],
      duplicateCompetitionIds: new Set(),
      greenRoomAssignments: [greenRoomAssignment()]
    });

    expect(result.ranks[0].registrationId).toBe('reg-old');
    expect(result.ranks[0].codeLetter).toBe('B');
    expect(result.recoveredFromGreenRoomAssignments).toHaveLength(1);
  });

  it('rejects a Green Room snapshot if the participant identity does not match the result rank', () => {
    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [undefined],
      targetRegistrations: [],
      duplicateCompetitionIds: new Set(),
      greenRoomAssignments: [greenRoomAssignment({ participantNameSnapshot: 'Someone Else' })]
    })).toThrow(/no unique approved replacement or matching same-competition green room code letter snapshot/i);
  });

  it('removes repeated identical rows after they resolve to the same registration', () => {
    const source = registration({ id: 'reg-old', status: 'PENDING' });
    const target = registration();

    const result = recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank(), makeRank()],
      sourceRegistrations: [source, source],
      targetRegistrations: [target],
      duplicateCompetitionIds: new Set()
    });

    expect(result.ranks).toHaveLength(1);
    expect(result.ranks[0].registrationId).toBe('reg-canonical');
    expect(result.duplicateRowsRemoved).toBe(1);
  });

  it('rejects conflicting duplicate rows instead of silently discarding marks', () => {
    const source = registration({ id: 'reg-old', status: 'PENDING' });
    const target = registration();

    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank(), makeRank({ score: 91 })],
      sourceRegistrations: [source, source],
      targetRegistrations: [target],
      duplicateCompetitionIds: new Set()
    })).toThrow(/conflicting duplicate result rows/i);
  });

  it('does not remap a registration from a different, non-duplicate competition without a matching Green Room snapshot', () => {
    const source = registration({ id: 'reg-old', competitionId: 'cmp-unrelated' });

    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [registration()],
      duplicateCompetitionIds: new Set()
    })).toThrow(/source competition is not an exact duplicate/i);
  });

  it('recovers a deleted legacy registration from an approved entry only with an exact team, bib and name match', () => {
    const target = registration();
    const result = recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank({ registrationId: 'reg-deleted' })],
      sourceRegistrations: [undefined],
      targetRegistrations: [target],
      duplicateCompetitionIds: new Set()
    });

    expect(result.ranks[0].registrationId).toBe('reg-canonical');
  });

  it('fails closed when the replacement registration is ambiguous or missing and no roster snapshot exists', () => {
    const source = registration({ id: 'reg-old', status: 'PENDING' });
    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [],
      duplicateCompetitionIds: new Set()
    })).toThrow(/no unique approved replacement or matching same-competition green room code letter snapshot/i);
  });

  it('rejects duplicate same-competition Code Letter snapshots for one registration', () => {
    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [undefined],
      targetRegistrations: [],
      duplicateCompetitionIds: new Set(),
      greenRoomAssignments: [greenRoomAssignment(), greenRoomAssignment({ codeLetter: 'C' })]
    })).toThrow(/multiple green room code letter records/i);
  });
});
