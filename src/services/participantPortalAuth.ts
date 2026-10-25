import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';

/**
 * Participant access is server-only. Never sign a Firebase client user into an
 * invented ADMIN or TEAM_MANAGER account. Participant DOB is a low-entropy
 * shared secret and Bib numbers are publicly visible and easily enumerable.
 * Enforce strict per-Bib and network limits, reject ambiguous Bib matches,
 * and strongly recommend a secondary activation PIN before a real rollout.
 */
const COOKIE_NAME = 'inspirath_participant_session';
const SESSION_SECONDS = 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_BIB = 5;
// Balances short Bib enumeration protection with schools sharing a single gateway.
const MAX_ATTEMPTS_IP = 100;

function getSecret(): string {
  const secret = process.env.PARTICIPANT_SESSION_SECRET || '';
  if (secret.length < 32) {
    throw new Error('Participant portal session secret is not configured.');
  }
  return secret;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sign(input: string): string {
  return createHmac('sha256', getSecret()).update(input).digest('base64url');
}

export function normalizeBib(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) return null;
    return `#${value}`;
  }
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  // The input may be #1042 or 1042; reject names, group codes, and full IDs.
  if (!/^#?[0-9]{1,9}$/.test(clean)) return null;
  const numeric = Number(clean.replace(/^#/, ''));
  if (!Number.isSafeInteger(numeric) || numeric < 1) return null;
  return `#${numeric}`;
}

function normalizeDob(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value
    ? null : value;
}

export const PARTICIPANT_COOKIE_NAME = COOKIE_NAME;
export const PARTICIPANT_COOKIE_OPTIONS = {
  path: '/api/participant',
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: SESSION_SECONDS
};

function createSession(participantId: string): string {
  const payload = Buffer.from(JSON.stringify({
    participantId,
    expiry: Date.now() + SESSION_SECONDS * 1000,
    nonce: randomBytes(16).toString('hex')
  }), 'utf8').toString('base64url');
  return payload + '.' + sign(payload);
}

function verifySession(token: string | undefined): string | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed.participantId !== 'string' ||
        !/^part-[a-zA-Z0-9_-]{1,100}$/.test(parsed.participantId) ||
        typeof parsed.expiry !== 'number' || parsed.expiry <= Date.now() ||
        parsed.expiry > Date.now() + (SESSION_SECONDS + 60) * 1000 ||
        typeof parsed.nonce !== 'string') return null;
    return parsed.participantId;
  } catch {
    return null;
  }
}

export async function getParticipantSession(request: NextRequest) {
  const participantId = verifySession(request.cookies.get(COOKIE_NAME)?.value);
  if (!participantId) return null;
  await syncWorkloadIdentityToken().catch(() => {});
  const db = getAdminDb();
  if (!db) return null;
  const snapshot = await db.collection('participants').doc(participantId).get();
  if (!snapshot.exists || snapshot.data()?.portalDisabled === true) return null;
  return { id: participantId, data: snapshot.data()!, db };
}

/**
 * Concurrency-Safe Rate Limiter:
 * Uses atomic Firestore transactions to inspect attempt limits and reserve an
 * attempt slot. If multiple concurrent requests hit simultaneously, the transaction
 * enforces serializable execution so concurrent requests cannot race past the
 * 5-attempt-per-Bib or 100-attempt-per-IP limits.
 *
 * Fail Closed: If the transaction cannot be executed, it throws an error and
 * blocks the login attempt rather than allowing unauthorized access.
 */
async function reserveLoginAttempt(bib: string, request: NextRequest): Promise<boolean> {
  const db = getAdminDb();
  if (!db) throw new Error('Participant service unavailable.');
  const ip = (request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1) ||
    'unknown').trim().slice(0, 120);

  const bibRef = db.collection('participantLoginAttempts').doc('bib-' + digest(bib));
  const ipRef = db.collection('participantLoginAttempts').doc('ip-' + digest(ip));
  const refs = [
    { ref: bibRef, limit: MAX_ATTEMPTS_BIB },
    { ref: ipRef, limit: MAX_ATTEMPTS_IP }
  ];

  try {
    return await db.runTransaction(async txn => {
      const snapshots = await Promise.all(refs.map(item => txn.get(item.ref as any)));
      const now = Date.now();
      const previous = snapshots.map(snap => (snap as any).data?.() || (snap as any).data);

      const isLimited = previous.some((data, i) =>
        data &&
        typeof data.windowStart === 'number' &&
        data.windowStart + WINDOW_MS > now &&
        Number(data.count || 0) >= refs[i].limit
      );

      if (isLimited) {
        return false;
      }

      // Atomically reserve attempt slot inside the transaction
      refs.forEach((item, i) => {
        const data = previous[i];
        const sameWindow = data && typeof data.windowStart === 'number' && data.windowStart + WINDOW_MS > now;
        txn.set(item.ref as any, {
          windowStart: sameWindow ? data.windowStart : now,
          count: sameWindow ? Number(data.count || 0) + 1 : 1,
          updatedAt: now
        }, { merge: true });
      });

      return true;
    });
  } catch (err) {
    // Fail closed: if rate-limit writes cannot be safely completed, fail immediately
    console.error('[ParticipantPortal] Rate limiter transaction failure (fail-closed):', err instanceof Error ? err.message : 'unknown');
    throw new Error('Participant security rate limiting is unavailable.');
  }
}

/**
 * On successful authentication with valid credentials:
 * 1. Resets the Bib failed attempt counter to 0 so legitimate repeat logins are never locked out.
 * 2. Decrements the IP counter so legitimate logins do not count towards the shared network failure limit.
 */
async function onLoginSuccess(bib: string, request: NextRequest): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  const ip = (request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1) ||
    'unknown').trim().slice(0, 120);

  const bibRef = db.collection('participantLoginAttempts').doc('bib-' + digest(bib));
  const ipRef = db.collection('participantLoginAttempts').doc('ip-' + digest(ip));

  try {
    await db.runTransaction(async txn => {
      const [bibSnap, ipSnap] = await Promise.all([txn.get(bibRef as any), txn.get(ipRef as any)]);
      const now = Date.now();

      // Clear Bib failed attempt counter
      if ((bibSnap as any).exists) {
        txn.set(bibRef as any, { count: 0, updatedAt: now }, { merge: true });
      }

      // Decrement IP count to release the reservation
      const ipData = (ipSnap as any).data?.() || (ipSnap as any).data;
      if ((ipSnap as any).exists && ipData && typeof ipData.count === 'number') {
        const sameWindow = typeof ipData.windowStart === 'number' && ipData.windowStart + WINDOW_MS > now;
        if (sameWindow && ipData.count > 0) {
          txn.set(ipRef as any, {
            count: Math.max(0, ipData.count - 1),
            updatedAt: now
          }, { merge: true });
        }
      }
    });
  } catch {
    // Non-critical cleanup
  }
}

export async function loginParticipant(request: NextRequest, bibInput: unknown, dob: unknown) {
  // Validate the signing key before checking credentials.
  getSecret();
  const bib = normalizeBib(bibInput);
  const birthDate = typeof dob === 'string' ? normalizeDob(dob) : null;
  if (!bib || !birthDate) {
    return { ok: false as const, limited: false };
  }
  await syncWorkloadIdentityToken().catch(() => {});

  // Atomically check and reserve an attempt slot inside a transaction.
  // Fails closed if rate-limit writes cannot be safely completed.
  const allowed = await reserveLoginAttempt(bib, request);
  if (!allowed) {
    return { ok: false as const, limited: true };
  }

  const db = getAdminDb();
  if (!db) throw new Error('Participant service unavailable.');
  const matches = await db.collection('participants').where('bib', '==', bib).limit(2).get();
  // Fail closed on duplicate Bib numbers. Never pick the first arbitrarily,
  // including when two participants have the same date of birth.
  if (matches.size !== 1) {
    return { ok: false as const, limited: false };
  }
  const participantDoc = matches.docs[0];
  const participantId = participantDoc.id;
  const record = participantDoc.data();
  if (!/^part-[a-zA-Z0-9_-]{1,100}$/.test(participantId) ||
      record.portalDisabled === true ||
      !normalizeDob(String(record.dob || '')) ||
      record.dob !== birthDate) {
    return { ok: false as const, limited: false };
  }

  // Release the reservation and clear Bib counter on successful login so legitimate repeat logins are never blocked
  await onLoginSuccess(bib, request);
  return { ok: true as const, token: createSession(participantId) };
}
