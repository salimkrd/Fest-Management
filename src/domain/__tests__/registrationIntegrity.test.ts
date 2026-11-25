import { describe, expect, it } from 'vitest';
import {
  findDuplicateRegistrationGroups,
  findExistingRegistrationConflicts,
  type RegistrationIdentityRecord
} from '../registrationIntegrity';

describe('competition registration identity integrity', () => {
  const registrations: RegistrationIdentityRecord[] = [
    { id: 'reg-a', participantId: 'person-1', participantName: 'Contestant One', teamCode: 'AAA', status: 'APPROVED' },
    { id: 'reg-b', participantId: 'person-2', participantName: 'Contestant Two', teamCode: 'BBB', status: 'APPROVED' },
    { id: 'reg-c', participantId: 'person-3', participantName: 'Contestant Three', status: 'CANCELLED' }
  ];

  it('blocks an entrant already registered by a different team', () => {
    const conflicts = findExistingRegistrationConflicts(registrations, ['person-1'], 'SOLO');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].record.id).toBe('reg-a');
  });

  it('does not treat rejected or cancelled registrations as active conflicts', () => {
    expect(findExistingRegistrationConflicts(registrations, ['person-3'], 'SOLO')).toEqual([]);
  });

  it('finds duplicate active entrant registrations across teams', () => {
    const duplicates = findDuplicateRegistrationGroups([
      ...registrations,
      { id: 'reg-a2', participantId: 'person-1', participantName: 'Contestant One', teamCode: 'CCC', status: 'APPROVED' }
    ], 'SOLO');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].identityId).toBe('person-1');
    expect(duplicates[0].records.map(record => record.id)).toEqual(['reg-a', 'reg-a2']);
  });

  it('detects overlapping legacy group members as duplicate entrants', () => {
    const duplicates = findDuplicateRegistrationGroups([
      { id: 'group-a', groupLeaderId: 'leader-a', groupMembers: ['member-x'], status: 'APPROVED' },
      { id: 'group-b', groupLeaderId: 'member-x', groupMembers: ['member-y'], status: 'APPROVED' }
    ], 'GROUP');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].identityId).toBe('member-x');
  });
});
