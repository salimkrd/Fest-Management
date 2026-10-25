import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getParticipantSession, loginParticipant } from '@/services/participantPortalAuth';

const documents = new Map<string, Record<string, unknown>>();
const fakeDatabase = {
  collection(name: string) {
    return {
      doc(id: string) {
        const key = name + '/' + id;
        return {
          key,
          async get() {
            return { exists: documents.has(key), data: () => documents.get(key) };
          }
        };
      }
    };
  },
  async runTransaction<T>(callback: (transaction: {
    get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
    set: (ref: { key: string }, data: Record<string, unknown>) => void
  }) => Promise<T>) {
    const pending: Array<{ key: string; data: Record<string, unknown> }> = [];
    const output = await callback({
      get: ref => ref.get(),
      set: (ref, data) => { pending.push({ key: ref.key, data }); }
    });
    pending.forEach(change => documents.set(change.key, change.data));
    return output;
  }
};
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => fakeDatabase }));

const loginRequest = () => new NextRequest('http://localhost:3000/api/participant/login', {
  method: 'POST',
  headers: { 'x-real-ip': '192.0.2.10' }
});

describe('Participant Portal ID + DOB session protections', () => {
  const prevSecret = process.env.PARTICIPANT_SESSION_SECRET;
  beforeEach(() => {
    documents.clear();
    process.env.PARTICIPANT_SESSION_SECRET = 'participant-portal-test-session-secret-with-strong-length';
    documents.set('participants/part-valid-1', {
      id: 'part-valid-1', name: 'Test Participant', dob: '2010-05-12', bib: '#1001'
    });
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.PARTICIPANT_SESSION_SECRET;
    else process.env.PARTICIPANT_SESSION_SECRET = prevSecret;
  });

  it('issues a signed session only for matching ID + DOB', async () => {
    const invalid = await loginParticipant(loginRequest(), 'part-valid-1', '2010-05-13');
    expect(invalid.ok).toBe(false);
    const correct = await loginParticipant(loginRequest(), 'part-valid-1', '2010-05-12');
    expect(correct.ok).toBe(true);
    if (!correct.ok) return;
    const sessionReq = new NextRequest('http://localhost:3000/api/participant/me', {
      headers: { cookie: 'inspirath_participant_session=' + correct.token }
    });
    expect((await getParticipantSession(sessionReq))?.id).toBe('part-valid-1');
  });

  it('rejects tampered cookie signatures', async () => {
    const correct = await loginParticipant(loginRequest(), 'part-valid-1', '2010-05-12');
    if (!correct.ok) throw new Error('unexpected failure');
    const forged = correct.token.slice(0, -1) + (correct.token.endsWith('a') ? 'b' : 'a');
    const req = new NextRequest('http://localhost:3000/api/participant/me', {
      headers: { cookie: 'inspirath_participant_session=' + forged }
    });
    expect(await getParticipantSession(req)).toBeNull();
  });

  it('limits repeated login guesses for each Participant ID', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await loginParticipant(loginRequest(), 'part-valid-1', '2009-01-01')).ok).toBe(false);
    }
    const result = await loginParticipant(loginRequest(), 'part-valid-1', '2010-05-12');
    expect(result).toMatchObject({ ok: false, limited: true });
  });

  it('rejects malformed dates and disabled participant profiles', async () => {
    expect((await loginParticipant(loginRequest(), 'part-valid-1', '2010-02-31')).ok).toBe(false);
    expect((await loginParticipant(loginRequest(), 'part-unknown', '2010-05-12')).ok).toBe(false);
    documents.set('participants/part-valid-1', { dob: '2010-05-12', portalDisabled: true });
    expect((await loginParticipant(loginRequest(), 'part-valid-1', '2010-05-12')).ok).toBe(false);
  });

  it('requires a dedicated strong signing secret', async () => {
    process.env.PARTICIPANT_SESSION_SECRET = 'short';
    await expect(loginParticipant(loginRequest(), 'part-valid-1', '2010-05-12'))
      .rejects.toThrow(/secret is not configured/i);
  });
});
