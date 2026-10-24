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
  token: string;
  version: 3;
}

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256(bytes: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const withPadLen = (((len + 8) >>> 6) + 1) << 6;
  const padded = new Uint8Array(withPadLen);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(withPadLen - 4, bitLen >>> 0, false);
  view.setUint32(withPadLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Int32Array(64);
  for (let chunk = 0; chunk < withPadLen; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunk + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[i] + w[i]) | 0;
      const s0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

export function hmacSha256Hex(keyBytes: Uint8Array, messageBytes: Uint8Array): string {
  let key = keyBytes;
  if (key.length > 64) {
    key = sha256(key);
  }
  const paddedKey = new Uint8Array(64);
  paddedKey.set(key);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const inner = new Uint8Array(64 + messageBytes.length);
  inner.set(iKeyPad);
  inner.set(messageBytes, 64);
  const innerHash = sha256(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(oKeyPad);
  outer.set(innerHash, 64);
  const outerHash = sha256(outer);

  return Array.from(outerHash).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an opaque cryptographic HMAC-SHA256 verification token for participant credentials.
 * Requires an explicit secretKey. Never falls back to a public or hardcoded key.
 */
export function generateQrVerificationToken(
  participantId: string,
  bib: string,
  secretKey: string
): string {
  if (!secretKey) {
    throw new Error('Cryptographic Error: secretKey is required to generate QR verification token.');
  }
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secretKey);
  const messageBytes = enc.encode(`${(participantId || '').trim()}:${(bib || '').trim().toUpperCase()}`);
  return hmacSha256Hex(keyBytes, messageBytes);
}

/**
 * Verifies the authenticity and integrity of a participant's QR verification token.
 * Requires an explicit secretKey. Performs constant-time comparison to prevent timing side-channels.
 */
export function verifyQrVerificationToken(
  participantId: string,
  bib: string,
  token: string,
  secretKey: string
): boolean {
  if (!participantId || !bib || !token || typeof token !== 'string' || !secretKey) return false;
  const expected = generateQrVerificationToken(participantId, bib, secretKey);
  if (expected.length !== token.trim().length) return false;
  let mismatch = 0;
  const cleanToken = token.trim();
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ cleanToken.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Encodes participant credentials into an opaque, securely signed JSON QR payload.
 * Requires a verified server-issued token. Does NOT leak participant names or team affiliations.
 */
export function encodeParticipantQrPayload(participant: {
  id: string;
  bib: string;
  token: string;
}): string {
  if (!participant.token) {
    throw new Error('Validation Error: A verified server-issued token is required to encode participant QR payload.');
  }
  const payload: ParticipantQrPayload = {
    app: 'INSPIRATH',
    type: 'PARTICIPANT_ID',
    id: participant.id,
    bib: participant.bib,
    token: participant.token,
    version: 3
  };
  return JSON.stringify(payload);
}

export interface ParsedQrResult {
  isValid: boolean;
  participantId?: string;
  bib?: string;
  token?: string;
  raw: string;
  format: 'JSON_PAYLOAD' | 'URI_STRING' | 'PLAIN_IDENTIFIER';
}

/**
 * Robustly parses a scanned QR code string into participant search identifiers and verification tokens.
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
          token: data.token || data.hash,
          raw,
          format: 'JSON_PAYLOAD'
        };
      }
    } catch {
      // Fall through if not valid JSON
    }
  }

  // 2. Try URI prefix format: INSPIRATH:PARTICIPANT:{id}:{bib}:{token?}
  if (raw.toUpperCase().startsWith('INSPIRATH:PARTICIPANT:')) {
    const parts = raw.split(':');
    const participantId = parts[2] || undefined;
    const bib = parts[3] || undefined;
    const token = parts[4] || undefined;
    return {
      isValid: Boolean(participantId || bib),
      participantId,
      bib,
      token,
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
