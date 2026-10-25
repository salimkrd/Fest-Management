import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

/**
 * Participant access is server-only. Never sign a Firebase client user into an
 * invented ADMIN or TEAM_MANAGER account. Participant DOB is a low-entropy
 * shared secret, therefore use unpredictable full Participant IDs and persistent
 * rate limits; recommend secondary activation PIN for stronger protection.
 */
const COOKIE_NAME = 'inspirath_participant_session';
const SESSION_SECONDS = 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_ID = 5;
const MAX_ATTEMPTS_IP = 25;

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
        parsed.expiry > Date.now() + SESSION_SECONDS * 1000 ||
        typeof parsed.nonce !== 'string') return null;
    return parsed.participantId;
  } catch {
    return null;
  }
}

export async function getParticipantSession(request: NextRequest) {
  const participantId = verifySession(request.cookies.get(COOKIE_NAME)?.value);
  if (!participantId) return null;
  const db = getAdminDb();
  if (!db) return null;
  const snapshot = await db.collection('participants').doc(participantId).get();
  if (!snapshot.exists || snapshot.data()?.portalDisabled === true) return null;
  return { id: participantId, data: snapshot.data()!, db };
}

/** The limiter is keyed independently by full ID and client network address. */
async function consumeAttempt(participantId: string, request: NextRequest) {
  const db = getAdminDb();
  if (!db) throw new Error('Participant service unavailable.');
  const ip = (request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1) ||
    'unknown').trim().slice(0, 120);
  const refs = [
    { ref: db.collection('participantLoginAttempts').doc('id-' + digest(participantId)), limit: MAX_ATTEMPTS_ID },
    { ref: db.collection('participantLoginAttempts').doc('ip-' + digest(ip)), limit: MAX_ATTEMPTS_IP }
  ];
  return db.runTransaction(async txn => {
    const snapshots = await Promise.all(refs.map(item => txn.get(item.ref)));
    const now = Date.now();
    const previous = snapshots.map(snap => snap.data());
    if (previous.some((data, i) => data && data.windowStart + WINDOW_MS > now && data.count >= refs[i].limit)) {
      return false;
    }
    refs.forEach((item, i) => {
      const data = previous[i];
      const sameWindow = data && typeof data.windowStart === 'number' && data.windowStart + WINDOW_MS > now;
      txn.set(item.ref, {
        windowStart: sameWindow ? data.windowStart : now,
        count: sameWindow ? data.count + 1 : 1,
        updatedAt: now
      });
    });
    return true;
  });
}

export async function loginParticipant(request: NextRequest, participantId: unknown, dob: unknown) {
  // Validate the configured HMAC secret before doing credential checks.
  getSecret();
  const id = typeof participantId === 'string' ? participantId.trim() : '';
  const birthDate = typeof dob === 'string' ? normalizeDob(dob) : null;
  if (!/^part-[a-zA-Z0-9_-]{1,100}$/.test(id) || !birthDate) {
    return { ok: false as const, limited: false };
  }
  if (!await consumeAttempt(id, request)) return { ok: false as const, limited: true };

  const db = getAdminDb();
  if (!db) throw new Error('Participant service unavailable.');
  const snapshot = await db.collection('participants').doc(id).get();
  const record = snapshot.data();
  if (!snapshot.exists || record?.portalDisabled === true ||
      !normalizeDob(String(record?.dob || '')) ||
      record!.dob !== birthDate) {
    return { ok: false as const, limited: false };
  }
  return { ok: true as const, token: createSession(id) };
}
