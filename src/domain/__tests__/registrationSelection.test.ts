import { describe, expect, it } from 'vitest';
import {
  normalizeParticipantSelection,
  validateGroupRosterSelection,
  validateIndividualBatchSelection
} from '@/domain/registrationSelection';

describe('registration participant selection', () => {
  it('normalizes duplicate and whitespace participant IDs safely', () => {
    expect(normalizeParticipantSelection([' part-1 ', 'part-2', 'part-1', '', null, 4]))
      .toEqual(['part-1', 'part-2']);
  });

  it('allows a valid individual batch while keeping each participant distinct', () => {
    expect(validateIndividualBatchSelection({
      participantIds: ['part-1', 'part-2', 'part-3'],
      alreadyRegisteredParticipantIds: ['part-4'],
      activeEntriesForTeam: 1,
      maximumEntriesPerTeam: 4
    })).toBeNull();
  });

  it('blocks an individual batch that would exceed the team entry limit', () => {
    expect(validateIndividualBatchSelection({
      participantIds: ['part-1', 'part-2'],
      alreadyRegisteredParticipantIds: [],
      activeEntriesForTeam: 2,
      maximumEntriesPerTeam: 3
    })).toMatch(/only 1 registration slot/i);
  });

  it('blocks participants who already have an active entry', () => {
    expect(validateIndividualBatchSelection({
      participantIds: ['part-1', 'part-2'],
      alreadyRegisteredParticipantIds: ['part-2'],
      activeEntriesForTeam: 0,
      maximumEntriesPerTeam: 5
    })).toMatch(/already registered/i);
  });

  it('requires an exact group roster size and a leader from that roster', () => {
    expect(validateGroupRosterSelection({
      leaderId: 'part-1',
      participantIds: ['part-1', 'part-2', 'part-3'],
      requiredGroupSize: 3
    })).toBeNull();

    expect(validateGroupRosterSelection({
      leaderId: 'part-1',
      participantIds: ['part-1', 'part-2'],
      requiredGroupSize: 3
    })).toMatch(/exactly 3 members/i);

    expect(validateGroupRosterSelection({
      leaderId: 'part-4',
      participantIds: ['part-1', 'part-2', 'part-3'],
      requiredGroupSize: 3
    })).toMatch(/group leader from the selected/i);
  });

  it('rejects duplicate group members and invalid group-size configuration', () => {
    expect(validateGroupRosterSelection({
      leaderId: 'part-1',
      participantIds: ['part-1', 'part-1', 'part-2'],
      requiredGroupSize: 3
    })).toMatch(/only appear once/i);

    expect(validateGroupRosterSelection({
      leaderId: 'part-1',
      participantIds: ['part-1'],
      requiredGroupSize: 1
    })).toMatch(/minimum 2/i);
  });
});
