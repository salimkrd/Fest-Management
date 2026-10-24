import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as judgeLoginHandler } from '@/app/api/judge/login/route';
import { getAdminDb } from '@/lib/firebase/admin';
import { hashSecret } from '@/domain/judgeAuth';

describe('POST /api/judge/login Endpoint Verification', () => {
  const db = getAdminDb();

  beforeAll(async () => {
    if (!db) return;

    const salt = 'randomsalt123456';
    const secretHash = await hashSecret('jury9999', salt);
    const now = new Date();
    const future = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
    const past = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

    // 1. Seed active test assignment
    await db.collection('judgeAssignments').doc('asgn-test-valid').set({
      id: 'asgn-test-valid',
      judgeName: 'Prof. Test Juror',
      judgePhone: '+91 98470 11111',
      competitionId: 'cmp-1',
      competitionCode: 'CMP-01',
      competitionName: 'Extempore Speech (English)',
      categoryName: 'Senior',
      type: 'SOLO',
      stageName: 'Main Auditorium',
      accessCode: 'JRY-TEST1',
      secretHash,
      salt,
      issuedAt: now.toISOString(),
      expiresAt: future,
      revoked: false,
      status: 'ACTIVE'
    });

    // 2. Seed revoked assignment
    await db.collection('judgeAssignments').doc('asgn-test-revoked').set({
      id: 'asgn-test-revoked',
      judgeName: 'Revoked Juror',
      judgePhone: '+91 98470 22222',
      competitionId: 'cmp-1',
      accessCode: 'JRY-REVOKED',
      secretHash,
      salt,
      issuedAt: now.toISOString(),
      expiresAt: future,
      revoked: true,
      status: 'REVOKED'
    });

    // 3. Seed expired assignment
    await db.collection('judgeAssignments').doc('asgn-test-expired').set({
      id: 'asgn-test-expired',
      judgeName: 'Expired Juror',
      judgePhone: '+91 98470 33333',
      competitionId: 'cmp-1',
      accessCode: 'JRY-EXPIRED',
      secretHash,
      salt,
      issuedAt: past,
      expiresAt: past,
      revoked: false,
      status: 'EXPIRED'
    });

    // 4. Seed user-reported access code JRY-LL4X
    await db.collection('judgeAssignments').doc('asgn-test-ll4x').set({
      id: 'asgn-test-ll4x',
      judgeName: 'Prof. Reporter Juror',
      judgePhone: '+91 98470 44444',
      competitionId: 'cmp-1',
      competitionCode: 'CMP-01',
      competitionName: 'Extempore Speech (English)',
      categoryName: 'Senior',
      type: 'SOLO',
      stageName: 'Main Auditorium',
      accessCode: 'JRY-LL4X',
      secretHash,
      salt,
      issuedAt: now.toISOString(),
      expiresAt: future,
      revoked: false,
      status: 'ACTIVE'
    });
  });

  it('1. Returns 400 Bad Request when access code is missing or empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode: '' })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provide your assigned juror access code/i);
  });

  it('2. Returns 404 Not Found when access code is non-existent', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode: 'JRY-NONEXISTENT' })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/invalid access code/i);
  });

  it('3. Successfully authenticates valid access code without PIN (cross-browser juror entry)', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-TEST1',
        competitionId: 'cmp-1'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignment.id).toBe('asgn-test-valid');
    expect(body.assignment.judgeName).toBe('Prof. Test Juror');
    expect(body.assignment.competitionId).toBe('cmp-1');
    // Salt and secretHash must NEVER be exposed to the client
    expect(body.assignment.secretHash).toBeUndefined();
    expect(body.assignment.salt).toBeUndefined();
  });

  it('4. Rejects with 403 Forbidden when assignment belongs to a different competition', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-TEST1',
        competitionId: 'cmp-99-other'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/valid for a different stage competition/i);
  });

  it('5. Successfully verifies when correct secret PIN is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-TEST1',
        competitionId: 'cmp-1',
        secret: 'jury9999'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('6. Rejects with 401 Unauthorized when incorrect secret PIN is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-TEST1',
        competitionId: 'cmp-1',
        secret: 'wrong-pin-1234'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid juror secret/i);
  });

  it('7. Rejects with 403 Forbidden when assignment has been revoked', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-REVOKED'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/revoked by the administrator/i);
  });

  it('8. Rejects with 403 Forbidden when assignment has expired', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-EXPIRED'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it('9. User-reported access code JRY-LL4X successfully authenticates in emulator', async () => {
    const req = new NextRequest('http://localhost:3000/api/judge/login', {
      method: 'POST',
      body: JSON.stringify({
        accessCode: 'JRY-LL4X',
        competitionId: 'cmp-1'
      })
    });
    const res = await judgeLoginHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignment.accessCode).toBe('JRY-LL4X');
    expect(body.assignment.competitionId).toBe('cmp-1');
  });
});
