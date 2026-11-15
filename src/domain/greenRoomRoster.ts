import { createHash } from 'crypto';
import { codeLetterToIndex, isValidCodeLetter } from './greenRoom';

export interface GreenRoomRosterDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface GreenRoomRosterEntry {
  competitionId: string;
  registrationId: string;
  codeLetter: string;
  codeIndex: number;
  status: string;
  participantId: string;
  participantName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  chestNumber: string;
  groupMembers: string[];
  groupLeaderId: string;
  groupSize: number | null;
}

function normalizedId(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function normalizedIdList(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (!Array.isArray(value)) {
    throw new Error('Roster Integrity Error: Group membership data is malformed. Judging has been blocked.');
  }
  return Array.from(new Set(value.map(normalizedId).filter(Boolean))).sort();
}

function normalizedGroupSize(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Roster Integrity Error: Declared group size is invalid. Judging has been blocked.');
  }
  return parsed;
}

/**
 * Verifies the person/team/group snapshot captured when the Code Letter was
 * assigned still matches the live registration. Registration IDs alone are
 * not sufficient if a registration record is later edited or reused.
 */
export function assertGreenRoomEntryMatchesRegistration(
  entry: GreenRoomRosterEntry,
  registration: Record<string, unknown>
): void {
  const registrationDocumentId = normalizedId(registration.id);
  const registrationCompetitionId = normalizedId(registration.competitionId);
  const participantId = normalizedId(registration.participantId);
  const participantName = normalizedId(registration.participantName);
  const teamId = normalizedId(registration.teamId);
  const teamCode = normalizedId(registration.teamCode).toUpperCase();
  const teamName = normalizedId(registration.teamName);
  const chestNumber = normalizedId(registration.chestNumber).toUpperCase();
  const groupMembers = normalizedIdList(registration.groupMembers);
  const groupLeaderId = normalizedId(registration.groupLeaderId);
  const groupSize = normalizedGroupSize(registration.groupSize);

  const matches =
    registrationDocumentId === entry.registrationId &&
    registrationCompetitionId === entry.competitionId &&
    entry.participantId === participantId &&
    entry.participantName === participantName &&
    entry.teamId === teamId &&
    entry.teamCode === teamCode &&
    entry.teamName === teamName &&
    entry.chestNumber === chestNumber &&
    JSON.stringify(entry.groupMembers) === JSON.stringify(groupMembers) &&
    entry.groupLeaderId === groupLeaderId &&
    entry.groupSize === groupSize;

  if (!matches) {
    throw new Error(
      `Roster Integrity Error: Code Letter "${entry.codeLetter}" no longer matches the participant and group identity snapshot for its registration. Judging has been blocked.`
    );
  }
}

export interface GreenRoomRosterSnapshot {
  entries: GreenRoomRosterEntry[];
  codeToRegistration: Map<string, string>;
  registrationToCode: Map<string, GreenRoomRosterEntry>;
  version: string;
}

/**
 * Builds a canonical, bijective Green Room code-to-registration mapping.
 *
 * This function deliberately fails closed. It never silently overwrites a
 * duplicate Code Letter or registration mapping, and it verifies the
 * deterministic Firestore document ID before the mapping can be used for
 * judging.
 */
export function buildGreenRoomRosterSnapshot(
  competitionId: string,
  documents: GreenRoomRosterDocument[]
): GreenRoomRosterSnapshot {
  if (!competitionId.trim()) {
    throw new Error('Roster Integrity Error: competitionId is required.');
  }

  const codeToRegistration = new Map<string, string>();
  const registrationToCode = new Map<string, GreenRoomRosterEntry>();
  const entries: GreenRoomRosterEntry[] = [];

  for (const document of documents) {
    const data = document.data || {};
    const recordCompetitionId = typeof data.competitionId === 'string'
      ? data.competitionId.trim()
      : '';
    const registrationId = typeof data.registrationId === 'string'
      ? data.registrationId.trim()
      : '';
    const rawCode = typeof data.codeLetter === 'string'
      ? data.codeLetter.trim().toUpperCase()
      : '';

    if (recordCompetitionId !== competitionId) {
      throw new Error('Roster Integrity Error: A Green Room assignment belongs to a different competition.');
    }
    if (!registrationId || document.id !== `${competitionId}_${registrationId}`) {
      throw new Error('Roster Integrity Error: A Green Room assignment does not match its canonical registration record.');
    }
    if (!isValidCodeLetter(rawCode)) {
      throw new Error('Roster Integrity Error: A Green Room assignment has an invalid Code Letter.');
    }

    const codeIndex = codeLetterToIndex(rawCode);
    const storedCodeIndex = data.codeIndex;
    if (
      storedCodeIndex !== undefined &&
      storedCodeIndex !== null &&
      (!Number.isInteger(Number(storedCodeIndex)) || Number(storedCodeIndex) !== codeIndex)
    ) {
      throw new Error(
        `Roster Integrity Error: Code Letter "${rawCode}" has an inconsistent code index.`
      );
    }

    const previousRegistration = codeToRegistration.get(rawCode);
    if (previousRegistration && previousRegistration !== registrationId) {
      throw new Error(
        `Roster Integrity Error: Code Letter "${rawCode}" is assigned to more than one registration. Judging has been blocked.`
      );
    }

    const previousCode = registrationToCode.get(registrationId);
    if (previousCode && previousCode.codeLetter !== rawCode) {
      throw new Error('Roster Integrity Error: One registration is assigned more than one Code Letter. Judging has been blocked.');
    }

    const entry: GreenRoomRosterEntry = {
      competitionId,
      registrationId,
      codeLetter: rawCode,
      codeIndex,
      status: typeof data.status === 'string' ? data.status : 'CHECKED_IN',
      participantId: normalizedId(data.participantId),
      participantName: normalizedId(data.participantNameSnapshot ?? data.participantName),
      teamId: normalizedId(data.teamId),
      teamCode: normalizedId(data.teamCode).toUpperCase(),
      teamName: normalizedId(data.teamName),
      chestNumber: normalizedId(data.chestNumber).toUpperCase(),
      groupMembers: normalizedIdList(data.groupMembers),
      groupLeaderId: normalizedId(data.groupLeaderId),
      groupSize: normalizedGroupSize(data.groupSize)
    };
    if (!entry.participantId && !entry.participantName && entry.groupMembers.length === 0) {
      throw new Error(
        `Roster Integrity Error: Code Letter "${rawCode}" has no verifiable participant or group identity. Judging has been blocked.`
      );
    }

    codeToRegistration.set(rawCode, registrationId);
    registrationToCode.set(registrationId, entry);
    entries.push(entry);
  }

  entries.sort((a, b) => a.codeIndex - b.codeIndex || a.codeLetter.localeCompare(b.codeLetter));

  // A stable opaque version binds the judge's open scorecard to the exact
  // Code Letter -> registration mapping that was shown when the session loaded.
  const versionPayload = JSON.stringify({
    competitionId,
    entries: entries.map(({
      registrationId,
      codeLetter,
      codeIndex,
      participantId,
      participantName,
      teamId,
      teamCode,
      teamName,
      chestNumber,
      groupMembers,
      groupLeaderId,
      groupSize
    }) => ({
      registrationId,
      codeLetter,
      codeIndex,
      participantId,
      participantName,
      teamId,
      teamCode,
      teamName,
      chestNumber,
      groupMembers,
      groupLeaderId,
      groupSize
    }))
  });
  const version = createHash('sha256').update(versionPayload).digest('hex');

  return {
    entries,
    codeToRegistration,
    registrationToCode,
    version
  };
}
