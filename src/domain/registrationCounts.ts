import type { Registration } from '@/types/fest';

export interface RegistrationCountRecord {
  participantId?: string;
  groupLeaderId?: string;
  groupMembers?: string[];
  groupMemberIds?: string[];
  competitionId?: string;
  status?: Registration['status'];
}

/**
 * Count unique registered competitions from registration documents.
 * Pending and approved registrations are active; rejected and cancelled
 * entries are excluded. A participant is counted once per competition,
 * including legacy group-member registrations.
 */
export function countParticipantRegisteredCompetitions(
  registrations: readonly RegistrationCountRecord[],
  participantId: string
): number {
  const competitionIds = new Set<string>();

  for (const registration of registrations) {
    if (registration.status === 'REJECTED' || registration.status === 'CANCELLED') continue;
    if (!registration.competitionId) continue;

    const belongsToParticipant =
      registration.participantId === participantId ||
      registration.groupLeaderId === participantId ||
      (registration.groupMembers ?? []).includes(participantId) ||
      (registration.groupMemberIds ?? []).includes(participantId);

    if (belongsToParticipant) competitionIds.add(registration.competitionId);
  }

  return competitionIds.size;
}

/**
 * Build one count per participant using the same rules as the ID card and
 * participant-facing registered-event summary.
 */
export function buildParticipantEventRegistrationCounts(
  registrations: readonly RegistrationCountRecord[]
): Map<string, number> {
  const competitionIdsByParticipant = new Map<string, Set<string>>();

  for (const registration of registrations) {
    if (registration.status === 'REJECTED' || registration.status === 'CANCELLED') continue;
    if (!registration.competitionId) continue;

    const participantIds = new Set<string>();
    if (registration.participantId) participantIds.add(registration.participantId);
    if (registration.groupLeaderId) participantIds.add(registration.groupLeaderId);
    for (const participantId of [...(registration.groupMembers ?? []), ...(registration.groupMemberIds ?? [])]) {
      if (participantId) participantIds.add(participantId);
    }

    for (const participantId of participantIds) {
      const competitionIds = competitionIdsByParticipant.get(participantId) ?? new Set<string>();
      competitionIds.add(registration.competitionId);
      competitionIdsByParticipant.set(participantId, competitionIds);
    }
  }

  return new Map(
    Array.from(competitionIdsByParticipant, ([participantId, competitionIds]) => [
      participantId,
      competitionIds.size
    ])
  );
}
