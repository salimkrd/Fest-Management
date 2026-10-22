/**
 * Secure Judge Assignment & Authentication Engine
 * 
 * Implements assignment-based security:
 * - Cryptographically generated access secrets.
 * - Password-specific KDF (scrypt) with salt; NO plaintext passwords stored.
 * - Expiration & revocation checks.
 * - Strict scope enforcement (Judges cannot access competitions or marks outside their assignment).
 * - Rate limiting on password verification attempts (lockout after repeated failures).
 * - WhatsApp direct dispatch link builder.
 */

import { scryptSync } from 'crypto';

export interface JudgeAssignmentRecord {
  id: string;
  judgeName: string;
  judgePhone: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  stageName: string;
  accessCode: string; // e.g. JRY-4821
  secretHash: string; // scrypt KDF hash with salt (NEVER plaintext)
  salt: string;
  issuedAt: string;
  expiresAt: string;
  expiresAtMs?: number;
  revoked: boolean;
  status: 'ACTIVE' | 'SUBMITTED' | 'EXPIRED' | 'REVOKED';
}

export interface GeneratedCredentials {
  assignment: JudgeAssignmentRecord;
  oneTimeSecret: string; // ONLY returned at creation time for the Admin to share
  directLoginUrl: string;
}

export interface VerificationResult {
  valid: boolean;
  assignmentId?: string;
  competitionId?: string;
  judgeName?: string;
  reason?: 'INVALID_CREDENTIALS' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' | 'RATE_LIMITED';
  remainingAttempts?: number;
}

// In-memory rate limiting tracker (per assignment or IP)
const failedAttemptsMap = new Map<string, { count: number; lastFailedAt: number }>();
export const MAX_ALLOWED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Standard scrypt Key Derivation Function (RFC 7914)
 * Uses N=16384, r=8, p=1, 64-byte keylen for slow, memory-hard resistance to brute-force attacks.
 */
export async function hashSecret(secret: string, salt: string): Promise<string> {
  const cleanSecret = secret.trim();
  // Server-side / Node.js scrypt KDF
  if (typeof scryptSync === 'function') {
    const derived = scryptSync(cleanSecret, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    });
    return `scrypt$${derived.toString('hex')}`;
  }

  // Fallback to Web Crypto PBKDF2 if scrypt is unavailable in client runtime
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(cleanSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    512
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return `pbkdf2$${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Verifies secret against a stored hash (supporting scrypt and legacy SHA-256).
 */
export async function verifyHash(inputSecret: string, storedHash: string, salt: string): Promise<boolean> {
  const cleanInput = inputSecret.trim();

  if (storedHash.startsWith('scrypt$')) {
    if (typeof scryptSync === 'function') {
      const derived = scryptSync(cleanInput, salt, 64, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 32 * 1024 * 1024
      });
      return `scrypt$${derived.toString('hex')}` === storedHash;
    }
  }

  // Legacy SHA-256 compatibility check
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${cleanInput}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const legacyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (legacyHash === storedHash) {
    return true;
  }

  const computedKdf = await hashSecret(cleanInput, salt);
  return computedKdf === storedHash;
}

/**
 * Checks rate limiting for a given assignment key.
 */
export function checkRateLimit(key: string): { isLocked: boolean; remaining: number } {
  const now = Date.now();
  const record = failedAttemptsMap.get(key);

  if (!record) {
    return { isLocked: false, remaining: MAX_ALLOWED_ATTEMPTS };
  }

  if (now - record.lastFailedAt > LOCKOUT_DURATION_MS) {
    // Lockout expired, reset
    failedAttemptsMap.delete(key);
    return { isLocked: false, remaining: MAX_ALLOWED_ATTEMPTS };
  }

  if (record.count >= MAX_ALLOWED_ATTEMPTS) {
    return { isLocked: true, remaining: 0 };
  }

  return { isLocked: false, remaining: MAX_ALLOWED_ATTEMPTS - record.count };
}

/**
 * Records a failed verification attempt.
 */
export function recordFailedAttempt(key: string): number {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, lastFailedAt: now };
  record.count += 1;
  record.lastFailedAt = now;
  failedAttemptsMap.set(key, record);
  return Math.max(0, MAX_ALLOWED_ATTEMPTS - record.count);
}

/**
 * Clears failed attempts upon successful verification.
 */
export function clearFailedAttempts(key: string): void {
  failedAttemptsMap.delete(key);
}

/**
 * Generates a cryptographically secure random alphanumeric token.
 */
export function generateRandomString(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, 0, 1, I
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Generates a new secure judge assignment with one-time credentials.
 */
export async function createJudgeAssignment(params: {
  id: string;
  judgeName: string;
  judgePhone: string;
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  stageName: string;
  durationHours?: number;
  baseUrl?: string;
}): Promise<GeneratedCredentials> {
  const salt = generateRandomString(16);
  const oneTimeSecret = `sec-${generateRandomString(6).toLowerCase()}-${generateRandomString(4).toLowerCase()}`;
  const secretHash = await hashSecret(oneTimeSecret, salt);
  const accessCode = `JRY-${generateRandomString(4)}`;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.durationHours || 24) * 60 * 60 * 1000).toISOString();

  const assignment: JudgeAssignmentRecord = {
    id: params.id,
    judgeName: params.judgeName,
    judgePhone: params.judgePhone,
    competitionId: params.competitionId,
    competitionCode: params.competitionCode,
    competitionName: params.competitionName,
    stageName: params.stageName,
    accessCode,
    secretHash,
    salt,
    issuedAt: now.toISOString(),
    expiresAt,
    expiresAtMs: new Date(expiresAt).getTime(),
    revoked: false,
    status: 'ACTIVE'
  };

  const baseUrl = params.baseUrl || 'http://localhost:3000';
  const directLoginUrl = `${baseUrl}/judge/login?code=${accessCode}&token=${encodeURIComponent(oneTimeSecret)}`;

  return {
    assignment,
    oneTimeSecret,
    directLoginUrl
  };
}

/**
 * Verifies credentials against an assignment record server-side with rate limiting.
 */
export async function verifyJudgeAssignment(
  assignment: JudgeAssignmentRecord | undefined | null,
  inputSecret: string
): Promise<VerificationResult> {
  if (!assignment) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  const rateCheck = checkRateLimit(assignment.id);
  if (rateCheck.isLocked) {
    return { valid: false, reason: 'RATE_LIMITED', remainingAttempts: 0 };
  }

  if (assignment.revoked || assignment.status === 'REVOKED') {
    return { valid: false, reason: 'REVOKED' };
  }

  const now = new Date();
  if (new Date(assignment.expiresAt) < now || assignment.status === 'EXPIRED') {
    return { valid: false, reason: 'EXPIRED' };
  }

  const storedHash = assignment.secretHash || (assignment as any).hashedSecret || '';
  const isMatch = await verifyHash(inputSecret, storedHash, assignment.salt);
  if (!isMatch) {
    const remaining = recordFailedAttempt(assignment.id);
    return { valid: false, reason: 'INVALID_CREDENTIALS', remainingAttempts: remaining };
  }

  // Clear failed attempts upon successful login
  clearFailedAttempts(assignment.id);

  return {
    valid: true,
    assignmentId: assignment.id,
    competitionId: assignment.competitionId,
    judgeName: assignment.judgeName
  };
}

/**
 * Builds the prepared WhatsApp dispatch link.
 * Does not assume auto-delivery; opens WhatsApp web/app with pre-filled message.
 */
export function buildWhatsAppDispatchUrl(params: {
  phone: string;
  festName: string;
  competitionName: string;
  judgeName: string;
  accessCode: string;
  oneTimeSecret: string;
  directUrl: string;
}): string {
  const cleanedPhone = params.phone.replace(/[^0-9]/g, '');

  const messageText = 
`Assalamu Alaikum / Greetings ${params.judgeName},

You have been designated as an Official Adjudicator for:
*${params.festName}*

*Event:* ${params.competitionName}
*Access Code:* ${params.accessCode}
*One-Time Secret:* ${params.oneTimeSecret}

Direct Secure Evaluation Sheet:
${params.directUrl}

*Instructions:*
1. Click the link above to enter your secure jury portal.
2. Confirm candidate chest numbers prior to score entry.
3. Submit and digitally sign your scorecard when the event concludes.

_This secret is confidential and valid for your assigned event only._`;

  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(messageText)}`;
}
