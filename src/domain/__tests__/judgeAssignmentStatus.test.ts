import { describe, expect, it } from 'vitest';
import { getJudgeAssignmentDisplayStatus } from '../judgeAssignmentStatus';

describe('judge assignment display status', () => {
  const now = Date.parse('2026-11-25T10:00:00.000Z');

  it('shows an unsubmitted assignment as expired when its expiry time has passed', () => {
    expect(getJudgeAssignmentDisplayStatus({
      status: 'NOT_STARTED',
      expiresAt: '2026-11-25T09:59:59.000Z'
    }, now)).toBe('EXPIRED');
  });

  it('shows an in-progress assignment as expired after its expiry time', () => {
    expect(getJudgeAssignmentDisplayStatus({
      status: 'IN_PROGRESS',
      expiresAt: '2026-11-25T09:00:00.000Z'
    }, now)).toBe('EXPIRED');
  });

  it('does not expire an assignment before its expiry time', () => {
    expect(getJudgeAssignmentDisplayStatus({
      status: 'NOT_STARTED',
      expiresAt: '2026-11-25T10:00:01.000Z'
    }, now)).toBe('NOT_STARTED');
  });

  it('keeps submitted assignments submitted after their access expiry', () => {
    expect(getJudgeAssignmentDisplayStatus({
      status: 'SUBMITTED',
      expiresAt: '2026-11-25T09:00:00.000Z'
    }, now)).toBe('SUBMITTED');
  });

  it('keeps revoked assignments revoked even after their expiry time', () => {
    expect(getJudgeAssignmentDisplayStatus({
      status: 'NOT_STARTED',
      expiresAt: '2026-11-25T09:00:00.000Z',
      revoked: true
    }, now)).toBe('REVOKED');
  });

  it('does not expire legacy assignments without a valid expiry timestamp', () => {
    expect(getJudgeAssignmentDisplayStatus({
      status: 'NOT_STARTED',
      expiresAt: 'invalid-date'
    }, now)).toBe('NOT_STARTED');
  });
});
