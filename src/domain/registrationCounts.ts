import type { Registration } from '@/types/fest';

/**
 * Build per-participant counts from the registration records, not the
 * legacy Participant.registeredEventIds mirror (which is not maintained
 * consistently by all registration flows).
 *
 * Individual entries count for participantId. Group entries count for the
 * recorded group leader and any legacy groupMembers IDs. A Set ensures a
 * leader present in both fields is only counted once for that registration.
 */
export function buildParticipantEventRegistrationCounts(
  registrations: readonly Registration[]
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const registration of registrations) {
    const participantIds = new Set<string>();

    if (registration.participantId) participantIds.add(registration.participantId);
    if (registration.groupLeaderId) participantIds.add(registration.groupLeaderId);

    for (const participantId of registration.groupMembers ?? []) {
      if (participantId) participantIds.add(participantId);
    }

    for (const participantId of participantIds) {
      counts.set(participantId, (counts.get(participantId) ?? 0) + 1);
    }
  }

  return counts;
}
