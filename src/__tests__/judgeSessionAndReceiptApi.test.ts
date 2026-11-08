import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as judgeSessionHandler } from '@/app/api/judge/session/route';
import { POST as judgeConfirmationHandler } from '@/app/api/judge/confirmation/route';

describe('Judge session and receipt APIs', () => {
  it('fails closed when the session refresh request has no assignment credentials', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/session', {
      method: 'POST',
      body: JSON.stringify({ assignmentId: '', competitionId: '', secret: '' })
    });
    const res = await judgeSessionHandler(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/secure judge session is incomplete/i);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('does not return a receipt from an incomplete or guessed URL', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/confirmation', {
      method: 'POST',
      body: JSON.stringify({ competitionId: 'cmp-1', verificationHash: 'SHA256:guess' })
    });
    const res = await judgeConfirmationHandler(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/receipt link is incomplete/i);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
