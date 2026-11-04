import { describe, expect, it } from 'vitest';
import type { Registration } from '@/types/fest';
import { buildParticipantEventRegistrationCounts } from '@/domain/registrationCounts';

const makeRegistration = (overrides: Partial<Registration> = {}): Registration => ({
  id: 'reg-1',
  code: 'REG-1001',
  participantName: 'Amin',
  teamId: 'team-a',
  teamCode: 'ALF',
  teamName: 'Al Farooq',
  categoryId: 'cat-junior',
  categoryName: 'Junior',
  competitionId: 'cmp-1',
  competitionName: 'Speech',
  type: 'SOLO',
  chestNumber: '#1001',
  status: 'APPROVED',
  registeredAt: '2026-11-05T10:00:00.000Z',
  ...overrides
});

describe('participant event registration counts', () => {
  it('counts actual individual registration records instead of participant mirror IDs', () => {
    const counts = buildParticipantEventRegistrationCounts([
      makeRegistration({ id: 'reg-1', participantId: 'part-1' }),
      makeRegistration({ id: 'reg-2', participantId: 'part-1', competitionId: 'cmp-2', status: 'PENDING' }),
      makeRegistration({ id: 'reg-3', participantId: 'part-2' })
    ]);

    expect(counts.get('part-1')).toBe(2);
    expect(counts.get('part-2')).toBe(1);
    expect(counts.has('part-3')).toBe(false);
  });

  it('counts group registrations for the leader and legacy group members', () => {
    const counts = buildParticipantEventRegistrationCounts([
      makeRegistration({
        id: 'reg-group',
        type: 'GROUP',
        participantId: undefined,
        groupLeaderId: 'part-leader',
        groupMembers: ['part-leader', 'part-member-2', 'part-member-3']
      })
    ]);

    expect(counts.get('part-leader')).toBe(1);
    expect(counts.get('part-member-2')).toBe(1);
    expect(counts.get('part-member-3')).toBe(1);
  });

  it('counts a registration only once when an ID appears in multiple participant fields', () => {
    const counts = buildParticipantEventRegistrationCounts([
      makeRegistration({
        id: 'reg-group',
        type: 'GROUP',
        groupLeaderId: 'part-1',
        groupMembers: ['part-1', 'part-2']
      })
    ]);

    expect(counts.get('part-1')).toBe(1);
    expect(counts.get('part-2')).toBe(1);
  });

  it('does not assign entries by participant display name and keeps recorded rejected entries visible in the total', () => {
    const counts = buildParticipantEventRegistrationCounts([
      makeRegistration({
        participantId: undefined,
        groupLeaderId: undefined,
        groupMembers: undefined,
        status: 'REJECTED'
      })
    ]);

    expect(counts.size).toBe(0);
  });
});
