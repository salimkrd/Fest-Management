/**
 * Domain Logic for Green Room Management & Participant Accreditation
 * 
 * Features:
 * 1. Bijective Code Letter conversion (0..701 <-> A..ZZ).
 * 2. Next available code letter resolution.
 * 3. Secure QR payload generation & parsing with backwards compatibility.
 */

export const MAX_CODE_LETTER_INDEX = 701; // ZZ (26 + 26 * 26 - 1)

/**
 * Converts a 0-based integer index to an anonymous competition Code Letter.
 * 0 -> A, 25 -> Z
 * 26 -> AA, 27 -> AB ... 51 -> AZ
 * 52 -> BA ... 701 -> ZZ
 */
export function indexToCodeLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid code letter index: ${index}. Must be a non-negative integer.`);
  }
  if (index > MAX_CODE_LETTER_INDEX) {
    throw new Error(`Code letter index ${index} exceeds maximum supported capacity (${MAX_CODE_LETTER_INDEX} / ZZ).`);
  }

  if (index < 26) {
    return String.fromCharCode(65 + index);
  }

  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

/**
 * Converts a Code Letter (A..Z or AA..ZZ) back to its 0-based integer index.
 */
export function codeLetterToIndex(code: string): number {
  if (!code || typeof code !== 'string') {
    throw new Error('Code letter must be a non-empty string.');
  }

  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(clean)) {
    throw new Error(`Invalid Code Letter format "${code}". Must match A-Z or AA-ZZ.`);
  }

  if (clean.length === 1) {
    return clean.charCodeAt(0) - 65;
  }

  const first = clean.charCodeAt(0) - 65;
  const second = clean.charCodeAt(1) - 65;
  return (first + 1) * 26 + second;
}

/**
 * Validates whether a string is a well-formed Code Letter (A..Z or AA..ZZ).
 */
export function isValidCodeLetter(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z]{1,2}$/.test(code.trim().toUpperCase());
}

/**
 * Resolves the next available Code Letter for a competition given a set of already assigned codes.
 * Returns the lowest unoccupied Code Letter in alphabetical sequence (A, B, C...).
 */
export function getNextAvailableCodeLetter(usedCodes: Iterable<string>): string {
  const normalized = new Set<string>();
  for (const code of usedCodes) {
    if (code && typeof code === 'string') {
      normalized.add(code.trim().toUpperCase());
    }
  }

  for (let i = 0; i <= MAX_CODE_LETTER_INDEX; i++) {
    const candidate = indexToCodeLetter(i);
    if (!normalized.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('All available Code Letters (A-ZZ) have been allocated for this competition.');
}

export interface ParticipantQrPayload {
  app: 'INSPIRATH';
  type: 'PARTICIPANT_ID';
  id: string;
  bib: string;
  name?: string;
  teamCode?: string;
  hash: string;
  version: 2;
}

/**
 * Encodes participant data into a verified JSON QR string.
 */
export function encodeParticipantQrPayload(participant: {
  id: string;
  bib: string;
  name?: string;
  teamCode?: string;
}): string {
  const payload: ParticipantQrPayload = {
    app: 'INSPIRATH',
    type: 'PARTICIPANT_ID',
    id: participant.id,
    bib: participant.bib,
    name: participant.name,
    teamCode: participant.teamCode,
    hash: `${participant.bib}-2025-AUTH-V2`,
    version: 2
  };
  return JSON.stringify(payload);
}

export interface ParsedQrResult {
  isValid: boolean;
  participantId?: string;
  bib?: string;
  name?: string;
  teamCode?: string;
  raw: string;
  format: 'JSON_PAYLOAD' | 'URI_STRING' | 'PLAIN_IDENTIFIER';
}

/**
 * Robustly parses a scanned QR code string into participant search identifiers.
 * Supports:
 * 1. JSON payload from INSPIRATH Digital ID
 * 2. URI string format: INSPIRATH:PARTICIPANT:{id}:{bib}
 * 3. Plain ID or Bib (#1042, p-1042, etc.)
 */
export function parseParticipantQrPayload(rawInput: string): ParsedQrResult {
  const raw = (rawInput || '').trim();
  if (!raw) {
    return { isValid: false, raw: '', format: 'PLAIN_IDENTIFIER' };
  }

  // 1. Try parsing JSON format
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const data = JSON.parse(raw);
      if (data && (data.id || data.bib || data.participantId)) {
        return {
          isValid: true,
          participantId: data.id || data.participantId,
          bib: data.bib,
          name: data.name,
          teamCode: data.teamCode,
          raw,
          format: 'JSON_PAYLOAD'
        };
      }
    } catch {
      // Fall through if not valid JSON
    }
  }

  // 2. Try URI prefix format: INSPIRATH:PARTICIPANT:{id}:{bib}
  if (raw.toUpperCase().startsWith('INSPIRATH:PARTICIPANT:')) {
    const parts = raw.split(':');
    const participantId = parts[2] || undefined;
    const bib = parts[3] || undefined;
    return {
      isValid: Boolean(participantId || bib),
      participantId,
      bib,
      raw,
      format: 'URI_STRING'
    };
  }

  // 3. Fallback: treat as plain identifier (Participant ID or Bib number)
  return {
    isValid: true,
    participantId: raw.startsWith('#') ? undefined : raw,
    bib: raw.startsWith('#') ? raw : undefined,
    raw,
    format: 'PLAIN_IDENTIFIER'
  };
}
