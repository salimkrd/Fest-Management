import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

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
  const db = getAdminDb();
  if (!db) return null;
  const snapshot = await db.collection('participants').doc(participantId).get();
  if (!snapshot.exists || snapshot.data()?.portalDisabled === true) return null;
  return { id: participantId, data: snapshot.data()!, db };
}

/** The limiter is keyed by normalized Bib, plus a separate shared network limit. */
async function consumeAttempt(bib: string, request: NextRequest) {
  const db = getAdminDb();
  if (!db) throw new Error('Participant service unavailable.');
  const ip = (request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1) ||
    'unknown').trim().slice(0, 120);
  const refs = [
    { ref: db.collection('participantLoginAttempts').doc('bib-' + digest(bib)), limit: MAX_ATTEMPTS_BIB },
    { ref: db.collection('participantLoginAttempts').doc('ip-' + digest(ip)), limit: MAX_ATTEMPTS_IP }
  ];
  return db.runTransaction(async txn => {
    const snapshots = await Promise.all(refs.map(item => txn.get(item.ref)));
    const now = Date.now();
    const previous = snapshots.map(snap => snap.data());
    if (previous.some((data, i) => data && typeof data.windowStart === 'number' &&
        data.windowStart + WINDOW_MS > now && Number(data.count || 0) >= refs[i].limit)) {
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

export async function loginParticipant(request: NextRequest, bibInput: unknown, dob: unknown) {
  // Validate the signing key before checking credentials.
  getSecret();
  const bib = normalizeBib(bibInput);
  const birthDate = typeof dob === 'string' ? normalizeDob(dob) : null;
  if (!bib || !birthDate) {
    return { ok: false as const, limited: false };
  }
  // Throttle even unknown Bib numbers to prevent account discovery.
  if (!await consumeAttempt(bib, request)) return { ok: false as const, limited: true };

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
  return { ok: true as const, token: createSession(participantId) };
}
