export type RegistrationCompetitionType = 'SOLO' | 'GROUP';

export interface RegistrationIdentityRecord {
  id: string;
  participantId?: string;
  groupLeaderId?: string;
  groupMembers?: string[];
  participantName?: string;
  code?: string;
  teamCode?: string;
  status?: string;
}

export interface DuplicateRegistrationGroup {
  identityId: string;
  records: RegistrationIdentityRecord[];
}

function entrantIdentityIds(
  record: RegistrationIdentityRecord,
  type: RegistrationCompetitionType
): string[] {
  const primaryId = type === 'GROUP'
    ? record.groupLeaderId || record.participantId
    : record.participantId || record.groupLeaderId;
  const values = type === 'GROUP' && Array.isArray(record.groupMembers)
    ? [primaryId, ...record.groupMembers]
    : [primaryId];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)));
}

function isActiveRegistration(record: RegistrationIdentityRecord): boolean {
  const status = String(record.status || 'APPROVED').trim().toUpperCase();
  return status !== 'REJECTED' && status !== 'CANCELLED';
}

/**
 * Finds active registrations that overlap the selected entrant identities.
 * Competition registrations are unique across all teams, not only within one team.
 */
export function findExistingRegistrationConflicts(
  records: readonly RegistrationIdentityRecord[],
  selectedEntrantIds: readonly string[],
  type: RegistrationCompetitionType
): Array<{ identityId: string; record: RegistrationIdentityRecord }> {
  const selected = new Set(selectedEntrantIds.map(id => id.trim()).filter(Boolean));
  const conflicts: Array<{ identityId: string; record: RegistrationIdentityRecord }> = [];
  for (const record of records) {
    if (!isActiveRegistration(record)) continue;
    for (const identityId of entrantIdentityIds(record, type)) {
      if (selected.has(identityId)) conflicts.push({ identityId, record });
    }
  }
  return conflicts;
}

/**
 * Detects multiple active registration documents representing the same entrant.
 * GROUP legacy records also reserve every saved group member to prevent overlap.
 */
export function findDuplicateRegistrationGroups(
  records: readonly RegistrationIdentityRecord[],
  type: RegistrationCompetitionType
): DuplicateRegistrationGroup[] {
  const byIdentity = new Map<string, RegistrationIdentityRecord[]>();
  for (const record of records) {
    if (!isActiveRegistration(record)) continue;
    for (const identityId of entrantIdentityIds(record, type)) {
      const group = byIdentity.get(identityId) || [];
      group.push(record);
      byIdentity.set(identityId, group);
    }
  }
  return Array.from(byIdentity.entries())
    .filter(([, group]) => new Set(group.map(record => record.id)).size > 1)
    .map(([identityId, group]) => ({
      identityId,
      records: Array.from(new Map(group.map(record => [record.id, record])).values())
    }));
}
