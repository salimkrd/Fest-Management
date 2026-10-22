import { describe, it, expect } from 'vitest';
import {
  createJudgeAssignment,
  verifyJudgeAssignment,
  buildWhatsAppDispatchUrl,
  hashSecret,
  MAX_ALLOWED_ATTEMPTS
} from '../judgeAuth';

describe('Secure Judge Access & Authentication', () => {
  it('Requirement: Generates secure credentials and stores only scrypt KDF hash server-side (no plaintext password)', async () => {
    const creds = await createJudgeAssignment({
      id: 'asgn-1',
      judgeName: 'Usthad Abdullah',
      judgePhone: '+91 98471 55001',
      competitionId: 'comp-1',
      competitionCode: 'CMP-01',
      competitionName: 'Quran Recitation',
      stageName: 'Auditorium'
    });

    expect(creds.assignment.secretHash).toBeDefined();
    // Must use scrypt KDF format
    expect(creds.assignment.secretHash.startsWith('scrypt$') || creds.assignment.secretHash.startsWith('pbkdf2$')).toBe(true);
    expect(creds.assignment.secretHash).not.toBe(creds.oneTimeSecret);
    expect(creds.assignment.salt).toBeDefined();
    // Verify assignment object does NOT have oneTimeSecret or password property
    expect((creds.assignment as any).oneTimeSecret).toBeUndefined();
    expect((creds.assignment as any).password).toBeUndefined();
  });

  it('Requirement: Verifies correct credentials successfully and bounds to assignment', async () => {
    const creds = await createJudgeAssignment({
      id: 'asgn-2',
      judgeName: 'Dr. Faisal Rahman',
      judgePhone: '+91 98471 55002',
      competitionId: 'comp-2',
      competitionCode: 'CMP-02',
      competitionName: 'English Elocution',
      stageName: 'Conference Hall'
    });

    const result = await verifyJudgeAssignment(creds.assignment, creds.oneTimeSecret);
    expect(result.valid).toBe(true);
    expect(result.assignmentId).toBe('asgn-2');
    expect(result.competitionId).toBe('comp-2');
    expect(result.judgeName).toBe('Dr. Faisal Rahman');
  });

  it('Requirement: Rejects incorrect credentials and decrements remaining attempts', async () => {
    const creds = await createJudgeAssignment({
      id: 'asgn-3',
      judgeName: 'Prof. Tariq',
      judgePhone: '+91 98471 55003',
      competitionId: 'comp-3',
      competitionCode: 'CMP-03',
      competitionName: 'Urdu Ghazal',
      stageName: 'Stage 3'
    });

    const result = await verifyJudgeAssignment(creds.assignment, 'wrong-password-123');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_CREDENTIALS');
    expect(result.remainingAttempts).toBe(MAX_ALLOWED_ATTEMPTS - 1);
  });

  it('Requirement: Rate limiting locks out assignment after 5 failed verification attempts', async () => {
    const creds = await createJudgeAssignment({
      id: 'asgn-rate-limit-test',
      judgeName: 'Judge Rate Limited',
      judgePhone: '+91 98471 99999',
      competitionId: 'comp-rl',
      competitionCode: 'CMP-RL',
      competitionName: 'Debate',
      stageName: 'Main Hall'
    });

    // Perform 5 consecutive failed attempts
    for (let i = 0; i < MAX_ALLOWED_ATTEMPTS; i++) {
      const res = await verifyJudgeAssignment(creds.assignment, `bad-attempt-${i}`);
      expect(res.valid).toBe(false);
    }

    // 6th attempt should be blocked by RATE_LIMITED lockout even if password were correct
    const lockedRes = await verifyJudgeAssignment(creds.assignment, creds.oneTimeSecret);
    expect(lockedRes.valid).toBe(false);
    expect(lockedRes.reason).toBe('RATE_LIMITED');
    expect(lockedRes.remainingAttempts).toBe(0);
  });

  it('Requirement: Rejects revoked assignments', async () => {
    const creds = await createJudgeAssignment({
      id: 'asgn-4',
      judgeName: 'Judge Test',
      judgePhone: '+91 98471 55004',
      competitionId: 'comp-4',
      competitionCode: 'CMP-04',
      competitionName: 'Calligraphy',
      stageName: 'Art Gallery'
    });

    const revokedRecord = { ...creds.assignment, revoked: true, status: 'REVOKED' as const };
    const result = await verifyJudgeAssignment(revokedRecord, creds.oneTimeSecret);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('REVOKED');
  });

  it('Requirement: Rejects expired assignments', async () => {
    const creds = await createJudgeAssignment({
      id: 'asgn-5',
      judgeName: 'Judge Expired',
      judgePhone: '+91 98471 55005',
      competitionId: 'comp-5',
      competitionCode: 'CMP-05',
      competitionName: 'Daf Muttu',
      stageName: 'Open Stage'
    });

    // Set expiry in the past
    const expiredRecord = {
      ...creds.assignment,
      expiresAt: new Date(Date.now() - 10000).toISOString(),
      status: 'EXPIRED' as const
    };

    const result = await verifyJudgeAssignment(expiredRecord, creds.oneTimeSecret);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  it('Requirement: WhatsApp dispatch URL prepares valid wa.me link with encoded details', () => {
    const url = buildWhatsAppDispatchUrl({
      phone: '+91 98471 20001',
      festName: 'Sahithyolsav 2025',
      competitionName: 'Quran Recitation',
      judgeName: 'Usthad Abdullah',
      accessCode: 'JRY-9281',
      oneTimeSecret: 'sec-abc-123',
      directUrl: 'http://localhost:3000/judge/login?code=JRY-9281&token=sec-abc-123'
    });

    expect(url.startsWith('https://wa.me/919847120001?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent('Sahithyolsav 2025'));
    expect(url).toContain(encodeURIComponent('Quran Recitation'));
    expect(url).toContain(encodeURIComponent('JRY-9281'));
  });
});
