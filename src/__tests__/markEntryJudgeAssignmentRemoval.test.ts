import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Admin Mark Entry judge assignment removal', () => {
  const pageSrc = readSource('src/app/admin/mark-entry/page.tsx');
  const contextSrc = readSource('src/context/FestContext.tsx');
  const serviceSrc = readSource('src/services/judgeService.ts');
  const routeSrc = readSource('src/app/api/admin/judge-assignments/revoke/route.ts');

  it('shows a remove action in both mobile and desktop Mark Entry layouts', () => {
    expect(pageSrc).toContain('Remove Judge');
    expect(pageSrc).toContain('grid grid-cols-1 gap-2 sm:grid-cols-3');
    expect(pageSrc).toContain('Actions');
    expect((pageSrc.match(/setAssignmentToRemove\(entry\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('requires explicit confirmation before revoking an assignment', () => {
    expect(pageSrc).toContain('Remove Judge Assignment Confirmation Modal');
    expect(pageSrc).toContain('Confirm Remove Judge');
    expect(pageSrc).toContain('handleConfirmRemoveAssignment');
    expect(pageSrc).toContain('Removing this judge immediately revokes their access');
  });

  it('does not offer removal for a submitted judge scorecard', () => {
    expect(pageSrc).toContain("disabled={entry.status === 'SUBMITTED'}");
    expect(serviceSrc).toContain('Submitted marks are immutable and this assignment cannot be removed.');
    expect(serviceSrc).toContain("String(markData?.status || '').toUpperCase() === 'SUBMITTED'");
  });

  it('requires an Admin-authenticated server endpoint rather than a client-only Firestore update', () => {
    expect(contextSrc).toContain("fetch('/api/admin/judge-assignments/revoke'");
    expect(contextSrc).toContain('Authorization: `Bearer ${await auth.currentUser.getIdToken()}`');
    expect(routeSrc).toContain('JudgeService.revokeAssignment(assignmentId, adminIdToken)');
    expect(serviceSrc).toContain('AuthService.assertAdmin(adminIdToken)');
  });

  it('revokes the token transactionally, preserves assignment history, and keeps at least one active judge', () => {
    expect(serviceSrc).toContain('await db.runTransaction(async (transaction) =>');
    expect(serviceSrc).toContain("status: 'REVOKED'");
    expect(serviceSrc).toContain('revokedAt');
    expect(serviceSrc).toContain('revokedByRole: \'ADMIN\'');
    expect(serviceSrc).toContain('At least one active judge must remain assigned to this competition.');
    expect(serviceSrc).toContain('assignedJudges: assignedJudgeNames');
    expect(serviceSrc).toContain('Keep the assignment and any draft record for audit history');
  });

  it('re-evaluates result readiness using only remaining active assignments', () => {
    expect(serviceSrc).toContain('await this.updateResultForCompetition(db, competitionId)');
    expect(serviceSrc).toContain("return !data.revoked && data.status !== 'REVOKED' && data.status !== 'EXPIRED'");
    expect(serviceSrc).toContain('assignments.some(doc => doc.data().status !== \'SUBMITTED\')');
  });

  it('blocks a racing judge submission after an assignment has been revoked', () => {
    expect(serviceSrc).toContain('Assignment has been revoked or expired. The judge cannot submit marks.');
    expect(serviceSrc).toContain('assignDoc.data()?.revoked === true');
  });
});
