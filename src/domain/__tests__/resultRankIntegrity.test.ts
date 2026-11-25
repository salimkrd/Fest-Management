import { describe, expect, it } from 'vitest';
import type { ResultRank } from '@/types/fest';
import { recoverResultRankIntegrity, type RegistrationIdentityRecord } from '../resultRankIntegrity';

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

  it('does not remap a registration from a different, non-duplicate competition', () => {
    const source = registration({ id: 'reg-old', competitionId: 'cmp-unrelated' });
    const target = registration();

    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [target],
      duplicateCompetitionIds: new Set()
    })).toThrow(/not an exact duplicate/i);
  });

  it('recovers a deleted legacy registration only with an exact team, bib and name match', () => {
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

  it('fails closed when the replacement registration is ambiguous or missing', () => {
    const source = registration({ id: 'reg-old', status: 'PENDING' });
    expect(() => recoverResultRankIntegrity({
      competitionId: 'cmp-main',
      ranks: [makeRank()],
      sourceRegistrations: [source],
      targetRegistrations: [],
      duplicateCompetitionIds: new Set()
    })).toThrow(/no unique approved replacement/i);
  });
});
