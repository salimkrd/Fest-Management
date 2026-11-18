import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Mark Entry judge assignment removal flow', () => {
  const page = readSource('src/app/admin/mark-entry/page.tsx');
  const context = readSource('src/context/FestContext.tsx');
  const service = readSource('src/services/judgeService.ts');

  it('offers Remove Judge actions in both mobile and desktop Mark Entry layouts', () => {
    expect((page.match(/Remove Judge/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(page).toContain('Assignment removed');
    expect(page).toContain('disabled={entry.status === \'SUBMITTED\'}');
  });

  it('requires explicit confirmation before calling the revocation action', () => {
    expect(page).toContain('Remove Judge Assignment Confirmation Modal');
    expect(page).toContain('title="Remove Judge Assignment?"');
    expect(page).toContain('Confirm Remove Judge');
    expect(page).toContain('onClick={handleConfirmRemoveAssignment}');
    expect(page).toContain('Removing this judge immediately revokes their access');
    expect(page).toContain('At least one active judge must remain assigned');
    expect(page).toContain('removeFeedbackIsWarning ?');
  });

  it('calls the secured admin revocation endpoint and only updates local state after success', () => {
    const requestIndex = context.indexOf("fetch('/api/admin/judge-assignments/revoke'");
    const successUpdateIndex = context.indexOf('setMarkEntries(prev => prev.map(entry =>', requestIndex);
    const responseCheckIndex = context.indexOf('if (!response.ok)', requestIndex);

    expect(requestIndex).toBeGreaterThan(-1);
    expect(responseCheckIndex).toBeGreaterThan(requestIndex);
    expect(successUpdateIndex).toBeGreaterThan(responseCheckIndex);
  });

  it('recalculates result readiness from remaining active assignments and excludes revoked scores', () => {
    expect(service).toContain('return !data.revoked && data.status !== \'REVOKED\' && data.status !== \'EXPIRED\'');
    expect(service).toContain('await this.updateResultForCompetition(db, competitionId)');
    expect(service).toContain("String(assignment.status || '').toUpperCase() === 'SUBMITTED'");
    expect(service).toContain('At least one active judge must remain assigned');
  });

  it('blocks mark drafts and final submissions if revocation wins the transaction race', () => {
    expect(service).toContain('currentAssignmentData.revoked');
    expect(service).toContain('assignDoc.data()?.revoked === true');
    expect(service).toContain('assignDoc.data()?.status === \'REVOKED\'');
  });
});
