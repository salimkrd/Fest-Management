import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getParticipantSession, loginParticipant, normalizeBib } from '@/services/participantPortalAuth';

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
          },
          async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
            const current = options?.merge ? (documents.get(key) || {}) : {};
            documents.set(key, { ...current, ...data });
          },
          async delete() {
            documents.delete(key);
          }
        };
      },
      where(field: string, operator: string, value: unknown) {
        if (name !== 'participants' || field !== 'bib' || operator !== '==') {
          throw new Error('Unexpected query in participant login test');
        }
        return {
          limit(max: number) {
            return {
              async get() {
                const docs = [...documents.entries()]
                  .filter(([key, data]) => key.startsWith('participants/') && data.bib === value)
                  .slice(0, max)
                  .map(([key, data]) => ({ id: key.slice('participants/'.length), data: () => data }));
                return { size: docs.length, docs };
              }
            };
          }
        };
      }
    };
  },
  async runTransaction<T>(callback: (transaction: {
    get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
    set: (ref: { key: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => void
  }) => Promise<T>) {
    const pending: Array<{ key: string; data: Record<string, unknown>; options?: { merge?: boolean } }> = [];
    const output = await callback({
      get: ref => ref.get(),
      set: (ref, data, options) => { pending.push({ key: ref.key, data, options }); }
    });
    pending.forEach(change => {
      const current = change.options?.merge ? (documents.get(change.key) || {}) : {};
      documents.set(change.key, { ...current, ...change.data });
    });
    return output;
  }
};
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => fakeDatabase,
  syncWorkloadIdentityToken: vi.fn().mockResolvedValue(null)
}));

const loginRequest = () => new NextRequest('http://localhost:3000/api/participant/login', {
  method: 'POST',
  headers: { 'x-real-ip': '192.0.2.10' }
});

describe('Participant Portal Bib + DOB session protections', () => {
  const prevSecret = process.env.PARTICIPANT_SESSION_SECRET;
  beforeEach(() => {
    documents.clear();
    process.env.PARTICIPANT_SESSION_SECRET = 'participant-portal-test-session-secret-with-strong-length';
    documents.set('participants/part-valid-1', {
      id: 'part-valid-1', name: 'Test Participant', dob: '2010-05-12', bib: '#1042'
    });
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.PARTICIPANT_SESSION_SECRET;
    else process.env.PARTICIPANT_SESSION_SECRET = prevSecret;
  });

  it('normalizes valid Bib numbers with or without a prefix', () => {
    expect(normalizeBib('1042')).toBe('#1042');
    expect(normalizeBib(' #1042 ')).toBe('#1042');
    expect(normalizeBib('#001042')).toBe('#1042');
    expect(normalizeBib('part-valid-1')).toBeNull();
    expect(normalizeBib('0')).toBeNull();
    expect(normalizeBib('#ABC')).toBeNull();
    expect(normalizeBib('')).toBeNull();
  });

  it('issues a participant-scoped signed session only for matching Bib and DOB', async () => {
    const invalid = await loginParticipant(loginRequest(), '1042', '2010-05-13');
    expect(invalid.ok).toBe(false);
    const correct = await loginParticipant(loginRequest(), '1042', '2010-05-12');
    expect(correct.ok).toBe(true);
    if (!correct.ok) return;
    const sessionReq = new NextRequest('http://localhost:3000/api/participant/me', {
      headers: { cookie: 'inspirath_participant_session=' + correct.token }
    });
    expect((await getParticipantSession(sessionReq))?.id).toBe('part-valid-1');
  });

  it('accepts #Bib login exactly as printed on the card', async () => {
    const result = await loginParticipant(loginRequest(), '#1042', '2010-05-12');
    expect(result.ok).toBe(true);
  });

  it('fails closed on duplicate Bib numbers even when DOB matches', async () => {
    documents.set('participants/part-valid-2', {
      id: 'part-valid-2', name: 'Different Participant', dob: '2010-05-12', bib: '#1042'
    });
    const result = await loginParticipant(loginRequest(), '1042', '2010-05-12');
    expect(result.ok).toBe(false);
  });

  it('rejects unknown Bib numbers without exposing account existence', async () => {
    expect((await loginParticipant(loginRequest(), '9999', '2010-05-12')).ok).toBe(false);
  });

  it('rejects tampered cookie signatures', async () => {
    const correct = await loginParticipant(loginRequest(), '1042', '2010-05-12');
    if (!correct.ok) throw new Error('unexpected failure');
    const forged = correct.token.slice(0, -1) + (correct.token.endsWith('a') ? 'b' : 'a');
    const req = new NextRequest('http://localhost:3000/api/participant/me', {
      headers: { cookie: 'inspirath_participant_session=' + forged }
    });
    expect(await getParticipantSession(req)).toBeNull();
  });

  it('limits repeated DOB guesses per Bib including its alternate # form', async () => {
    for (let i = 0; i < 5; i++) {
      const bib = i % 2 === 0 ? '#1042' : '1042';
      expect((await loginParticipant(loginRequest(), bib, '2009-01-01')).ok).toBe(false);
    }
    const result = await loginParticipant(loginRequest(), '1042', '2010-05-12');
    expect(result).toMatchObject({ ok: false, limited: true });
  });

  it('rejects malformed dates and disabled participant profiles', async () => {
    expect((await loginParticipant(loginRequest(), '1042', '2010-02-31')).ok).toBe(false);
    documents.set('participants/part-valid-1', { bib: '#1042', dob: '2010-05-12', portalDisabled: true });
    expect((await loginParticipant(loginRequest(), '1042', '2010-05-12')).ok).toBe(false);
  });

  it('requires a dedicated strong signing secret', async () => {
    process.env.PARTICIPANT_SESSION_SECRET = 'short';
    await expect(loginParticipant(loginRequest(), '1042', '2010-05-12'))
      .rejects.toThrow(/secret is not configured/i);
  });
});
