import { describe, expect, it } from 'vitest';
import {
  buildParticipantEventRegistrationCounts,
  countParticipantRegisteredCompetitions,
  type RegistrationCountRecord
} from '@/domain/registrationCounts';

describe('participant registered competition counts', () => {
  it('counts unique active competitions and ignores rejected or cancelled registrations', () => {
    const registrations: RegistrationCountRecord[] = [
      { participantId: 'p1', competitionId: 'c1', status: 'APPROVED' },
      { participantId: 'p1', competitionId: 'c1', status: 'PENDING' },
      { participantId: 'p1', competitionId: 'c2', status: 'PENDING' },
      { participantId: 'p1', competitionId: 'c3', status: 'REJECTED' },
      { participantId: 'p1', competitionId: 'c4', status: 'CANCELLED' }
    ];

    expect(countParticipantRegisteredCompetitions(registrations, 'p1')).toBe(2);
    expect(buildParticipantEventRegistrationCounts(registrations).get('p1')).toBe(2);
  });

  it('counts group leader and legacy group members once per competition', () => {
    const registrations: RegistrationCountRecord[] = [
      {
        participantId: 'leader',
        groupLeaderId: 'leader',
        groupMembers: ['leader', 'member'],
        competitionId: 'group-comp',
        status: 'APPROVED'
      },
      {
        groupLeaderId: 'leader',
        groupMembers: ['leader', 'member'],
        competitionId: 'group-comp',
        status: 'PENDING'
      },
      {
        participantId: 'member',
        competitionId: 'solo-comp',
        status: 'APPROVED'
      }
    ];

    const counts = buildParticipantEventRegistrationCounts(registrations);
    expect(countParticipantRegisteredCompetitions(registrations, 'leader')).toBe(1);
    expect(countParticipantRegisteredCompetitions(registrations, 'member')).toBe(2);
    expect(counts.get('leader')).toBe(1);
    expect(counts.get('member')).toBe(2);
  });

  it('does not count registrations without a competition ID', () => {
    const registrations: RegistrationCountRecord[] = [
      { participantId: 'p1', status: 'APPROVED' },
      { participantId: 'p1', competitionId: '', status: 'PENDING' }
    ];

    expect(countParticipantRegisteredCompetitions(registrations, 'p1')).toBe(0);
    expect(buildParticipantEventRegistrationCounts(registrations).has('p1')).toBe(false);
  });
});
