import type { MarkEntry } from '@/types/fest';

/**
 * Returns the status that should be displayed for a judge assignment.
 * The persisted status can remain ACTIVE/NOT_STARTED after expiresAt;
 * submitted and revoked assignments remain terminal and are not relabeled.
 */
export function getJudgeAssignmentDisplayStatus(
  assignment: Pick<MarkEntry, 'status' | 'expiresAt' | 'revoked'>,
  nowMs: number = Date.now()
): MarkEntry['status'] {
  if (assignment.revoked || assignment.status === 'REVOKED') {
    return 'REVOKED';
  }

  if (assignment.status === 'SUBMITTED' || assignment.status === 'EXPIRED') {
    return assignment.status;
  }

  const expiresAtMs = assignment.expiresAt ? Date.parse(assignment.expiresAt) : Number.NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
    return 'EXPIRED';
  }

  return assignment.status;
}
