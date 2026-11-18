import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Admin Mark Entry Open Sheet scorecard view', () => {
  const page = readSource('src/app/admin/mark-entry/page.tsx');
  const route = readSource('src/app/api/admin/judge-assignments/[assignmentId]/scorecard/route.ts');
  const service = readSource('src/services/judgeService.ts');
  const domain = readSource('src/domain/judgeScorecard.ts');

  it('opens the Admin scorecard view from both responsive Mark Entry layouts', () => {
    expect((page.match(/onClick=\{\(\) => void handleOpenScorecard\(entry\)\}/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(page).toContain('Admin-only Judge Scorecard Modal');
    expect(page).not.toContain('/judge/marking?code=');
  });

  it('uses an Admin-authenticated no-store read endpoint', () => {
    expect(page).toContain('/api/admin/judge-assignments/');
    expect(page).toContain('cache: \'no-store\'');
    expect(route).toContain("authorization.startsWith('Bearer ')");
    expect(route).toContain('JudgeService.getAdminScorecard(assignmentId, adminIdToken)');
    expect(route).toContain('Cache-Control');
    expect(service).toContain('AuthService.assertAdmin(adminIdToken)');
  });

  it('displays only Code Letters and criterion/total marks in the view model', () => {
    expect(page).toContain('row.codeLetter');
    expect(page).toContain('row.criterionMarks[criterion.id]');
    expect(page).toContain('row.totalMarks');
    expect(page).toContain('Participant names, registration IDs and personal details are not displayed.');
    expect(domain).toContain('codeRegistrationSnapshot');
    expect(domain).not.toContain('participantName:');
    expect(domain).toContain('neither is returned to the caller');
  });

  it('does not guess the mapping for drafts when the live Green Room roster has changed', () => {
    expect(domain).toContain('roster.version !== version');
    expect(domain).toContain('Unverified Mapping Error');
    expect(domain).toContain('The Green Room roster changed after this draft was saved');
  });

  it('uses the immutable archived Code Letter mapping for submitted scorecards', () => {
    expect(domain).toContain('archivedCodeMap(markData)');
    expect(domain).toContain('markStatus === \'SUBMITTED\'');
    expect(domain).toContain('codeIndex');
  });
});
