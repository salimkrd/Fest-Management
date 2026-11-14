export function normalizeParticipantSelection(ids: readonly unknown[]): string[] {
  return Array.from(new Set(
    ids
      .filter((id): id is string => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean)
  ));
}

export function validateIndividualBatchSelection(params: {
  participantIds: readonly string[];
  alreadyRegisteredParticipantIds: readonly string[];
  activeEntriesForTeam: number;
  maximumEntriesPerTeam: number;
}): string | null {
  if (params.participantIds.length === 0) {
    return 'Select at least one participant.';
  }

  const selected = new Set(params.participantIds);
  if (selected.size !== params.participantIds.length) {
    return 'A participant can only be selected once in a registration batch.';
  }

  const alreadyRegistered = new Set(params.alreadyRegisteredParticipantIds);
  const duplicate = params.participantIds.find(id => alreadyRegistered.has(id));
  if (duplicate) {
    return 'One or more selected participants are already registered for this competition.';
  }

  const availableSlots = Math.max(0, params.maximumEntriesPerTeam - params.activeEntriesForTeam);
  if (params.participantIds.length > availableSlots) {
    return `This team has only ${availableSlots} registration slot(s) remaining for this competition.`;
  }

  return null;
}

export function validateGroupRosterSelection(params: {
  leaderId: string;
  participantIds: readonly string[];
  requiredGroupSize: number;
}): string | null {
  if (!Number.isInteger(params.requiredGroupSize) || params.requiredGroupSize < 2) {
    return 'Set a valid Members Per Group value (minimum 2) in the competition first.';
  }

  if (params.participantIds.length !== params.requiredGroupSize) {
    return `Select exactly ${params.requiredGroupSize} members for this group.`;
  }

  if (new Set(params.participantIds).size !== params.participantIds.length) {
    return 'A participant can only appear once in a group.';
  }

  if (!params.leaderId || !params.participantIds.includes(params.leaderId)) {
    return 'Choose the group leader from the selected group members.';
  }

  return null;
}
