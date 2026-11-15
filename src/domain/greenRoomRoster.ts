import { createHash } from 'crypto';
import { codeLetterToIndex, isValidCodeLetter } from './greenRoom';

export interface GreenRoomRosterDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface GreenRoomRosterEntry {
  registrationId: string;
  codeLetter: string;
  codeIndex: number;
  status: string;
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
      throw new Error(
        `Roster Integrity Error: Green Room record "${document.id}" belongs to a different competition.`
      );
    }
    if (!registrationId || document.id !== `${competitionId}_${registrationId}`) {
      throw new Error(
        `Roster Integrity Error: Green Room record "${document.id}" does not match its canonical registration mapping.`
      );
    }
    if (!isValidCodeLetter(rawCode)) {
      throw new Error(
        `Roster Integrity Error: Registration "${registrationId}" has an invalid Code Letter.`
      );
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
      throw new Error(
        `Roster Integrity Error: Registration "${registrationId}" has more than one Code Letter. Judging has been blocked.`
      );
    }

    const entry: GreenRoomRosterEntry = {
      registrationId,
      codeLetter: rawCode,
      codeIndex,
      status: typeof data.status === 'string' ? data.status : 'CHECKED_IN'
    };

    codeToRegistration.set(rawCode, registrationId);
    registrationToCode.set(registrationId, entry);
    entries.push(entry);
  }

  entries.sort((a, b) => a.codeIndex - b.codeIndex || a.codeLetter.localeCompare(b.codeLetter));

  // A stable opaque version binds the judge's open scorecard to the exact
  // Code Letter -> registration mapping that was shown when the session loaded.
  const versionPayload = JSON.stringify({
    competitionId,
    entries: entries.map(({ registrationId, codeLetter, codeIndex }) => ({
      registrationId,
      codeLetter,
      codeIndex
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
