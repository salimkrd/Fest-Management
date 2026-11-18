import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Filter = { field: string; value: unknown };
  const documents = new Map<string, Data>();
  const writes: string[] = [];
  const clone = <T,>(value: T): T => structuredClone(value);

  const snapshot = (path: string) => ({
    id: path.split('/').at(-1) || '',
    exists: documents.has(path),
    data: () => {
      const value = documents.get(path);
      return value ? clone(value) : undefined;
    }
  });

  const documentReference = (path: string) => ({
    __path: path,
    id: path.split('/').at(-1) || '',
    get: async () => snapshot(path),
    set: async (value: Data, options?: { merge?: boolean }) => {
      const next = options?.merge
        ? { ...(documents.get(path) || {}), ...clone(value) }
        : clone(value);
      documents.set(path, next);
      writes.push(path);
    },
    update: async (value: Data) => {
      const previous = documents.get(path);
      if (!previous) throw new Error('Document does not exist: ' + path);
      documents.set(path, { ...previous, ...clone(value) });
      writes.push(path);
    }
  });

  const queryReference = (path: string, filters: Filter[] = []) => ({
    __queryPath: path,
    where: (field: string, _operator: string, value: unknown) =>
      queryReference(path, [...filters, { field, value }]),
    get: async () => {
      const depth = path.split('/').length + 1;
      const docs = [...documents.entries()]
        .filter(([key, value]) =>
          key.startsWith(path + '/') &&
          key.split('/').length === depth &&
          filters.every(filter => value[filter.field] === filter.value)
        )
        .map(([key]) => snapshot(key));
      return { docs, empty: docs.length === 0, size: docs.length };
    }
  });

  const collection = (path: string) => ({
    doc: (id: string) => documentReference(path + '/' + id),
    where: (field: string, _operator: string, value: unknown) =>
      queryReference(path, [{ field, value }]),
    get: async () => queryReference(path).get()
  });

  const db = {
    collection,
    runTransaction: async <T,>(callback: (transaction: {
      get: (target: { __path?: string; __queryPath?: string; get?: () => Promise<unknown> }) => Promise<unknown>;
      update: (reference: { __path: string }, value: Data) => void;
      set: (reference: { __path: string }, value: Data, options?: { merge?: boolean }) => void;
    }) => Promise<T>) => {
      const pendingWrites: Array<() => Promise<void>> = [];
      const transaction = {
        get: async (target: { __path?: string; __queryPath?: string; get?: () => Promise<unknown> }) => {
          if (target.__queryPath && target.get) return target.get();
          return snapshot(target.__path || '');
        },
        update: (reference: { __path: string }, value: Data) => {
          pendingWrites.push(() => documentReference(reference.__path).update(value));
        },
        set: (reference: { __path: string }, value: Data, options?: { merge?: boolean }) => {
          pendingWrites.push(() => documentReference(reference.__path).set(value, options));
        }
      };
      const result = await callback(transaction);
      for (const write of pendingWrites) await write();
      return result;
    }
  };

  return { documents, writes, db, assertAdmin: vi.fn() };
});

vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => harness.db }));
vi.mock('@/services/authService', () => ({ AuthService: { assertAdmin: harness.assertAdmin } }));

import { JudgeService } from '@/services/judgeService';

const competitionId = 'cmp-revoke-test';
const wrongAssignmentId = 'asgn-wrong';
const validAssignmentId = 'asgn-valid';

function seedScenario(options?: {
  wrongStatus?: string;
  resultStatus?: string;
  includeValidAssignment?: boolean;
  validScore?: number;
}) {
  const { documents } = harness;
  documents.clear();
  harness.writes.length = 0;

  documents.set('competitions/' + competitionId, {
    id: competitionId,
    code: 'CMP-REV',
    name: 'English Speech',
    categoryName: 'Senior',
    type: 'SOLO',
    criteria: [{ id: 'overall', name: 'Overall', maxMarks: 100 }],
    maxMarks: 100,
    assignedJudges: options?.includeValidAssignment === false
      ? ['Wrong Judge']
      : ['Wrong Judge', 'Valid Judge']
  });
  documents.set('results/res-' + competitionId, {
    id: 'res-' + competitionId,
    competitionId,
    marksStatus: 'PARTIAL',
    resultStatus: options?.resultStatus || 'AWAITING_MARKS',
    ranks: []
  });
  documents.set('judgeAssignments/' + wrongAssignmentId, {
    id: wrongAssignmentId,
    competitionId,
    judgeName: 'Wrong Judge',
    judgePhone: '+91 90000 00001',
    revoked: false,
    status: options?.wrongStatus || 'IN_PROGRESS'
  });

  if (options?.includeValidAssignment !== false) {
    documents.set('judgeAssignments/' + validAssignmentId, {
      id: validAssignmentId,
      competitionId,
      judgeName: 'Valid Judge',
      judgePhone: '+91 90000 00002',
      revoked: false,
      status: 'SUBMITTED'
    });
    documents.set('markEntries/me-' + validAssignmentId, {
      id: 'me-' + validAssignmentId,
      assignmentId: validAssignmentId,
      competitionId,
      status: 'SUBMITTED',
      isFinal: true,
      scores: { 'reg-1': options?.validScore ?? 91 }
    });
  }

  // Keep a draft for the mistaken judge. Its score must not be used after removal.
  documents.set('markEntries/me-' + wrongAssignmentId, {
    id: 'me-' + wrongAssignmentId,
    assignmentId: wrongAssignmentId,
    competitionId,
    status: 'DRAFT',
    isFinal: false,
    scores: { 'reg-1': 5 }
  });

  documents.set('registrations/reg-1', {
    competitionId,
    status: 'APPROVED',
    participantId: 'part-1',
    participantName: 'Student One',
    teamId: 'team-1',
    teamCode: 'T1',
    teamName: 'Team One',
    chestNumber: '101',
    groupMembers: [],
    groupLeaderId: '',
    groupSize: null
  });
  documents.set('greenRoomAssignments/' + competitionId + '_reg-1', {
    competitionId,
    registrationId: 'reg-1',
    codeLetter: 'A',
    codeIndex: 0,
    status: 'CHECKED_IN',
    participantId: 'part-1',
    participantNameSnapshot: 'Student One',
    teamId: 'team-1',
    teamCode: 'T1',
    teamName: 'Team One',
    chestNumber: '101',
    groupMembers: [],
    groupLeaderId: '',
    groupSize: null
  });
}

describe('Judge assignment revocation and result refresh', () => {
  beforeEach(() => {
    harness.assertAdmin.mockReset().mockResolvedValue({
      uid: 'verified-admin-1',
      role: 'ADMIN'
    });
    seedScenario();
  });

  it('revokes a mistaken assignment and recalculates the result using only the remaining submitted judge', async () => {
    const response = await JudgeService.revokeAssignment(wrongAssignmentId, 'admin-token');

    expect(response).toMatchObject({
      assignmentId: wrongAssignmentId,
      competitionId,
      remainingActiveJudges: 1
    });
    expect(harness.documents.get('judgeAssignments/' + wrongAssignmentId)).toMatchObject({
      revoked: true,
      status: 'REVOKED',
      revokedBy: 'verified-admin-1',
      revokedByRole: 'ADMIN'
    });
    expect(harness.documents.get('competitions/' + competitionId)?.assignedJudges).toEqual(['Valid Judge']);

    // The original draft stays available for audit, but it is excluded from scoring.
    expect(harness.documents.get('markEntries/me-' + wrongAssignmentId)?.status).toBe('DRAFT');
    const result = harness.documents.get('results/res-' + competitionId) || {};
    expect(result.resultStatus).toBe('READY_FOR_REVIEW');
    expect(result.marksStatus).toBe('COMPLETE');
    expect((result.ranks as Array<{ score: number }>)[0]?.score).toBe(91);
  });

  it('does not remove the last active judge from a competition', async () => {
    seedScenario({ includeValidAssignment: false });

    await expect(JudgeService.revokeAssignment(wrongAssignmentId, 'admin-token'))
      .rejects.toThrow(/At least one active judge must remain/);

    expect(harness.documents.get('judgeAssignments/' + wrongAssignmentId)).toMatchObject({
      revoked: false,
      status: 'IN_PROGRESS'
    });
    expect(harness.writes).toEqual([]);
  });

  it('protects a judge assignment that has submitted a final scorecard', async () => {
    seedScenario({ wrongStatus: 'SUBMITTED' });
    harness.documents.set('markEntries/me-' + wrongAssignmentId, {
      id: 'me-' + wrongAssignmentId,
      assignmentId: wrongAssignmentId,
      competitionId,
      status: 'SUBMITTED',
      isFinal: true,
      scores: { 'reg-1': 80 }
    });

    await expect(JudgeService.revokeAssignment(wrongAssignmentId, 'admin-token'))
      .rejects.toThrow(/Submitted marks are immutable/);

    expect(harness.documents.get('judgeAssignments/' + wrongAssignmentId)?.status).toBe('SUBMITTED');
    expect(harness.writes).toEqual([]);
  });

  it('blocks assignment changes after the result is ready to publish or published', async () => {
    seedScenario({ resultStatus: 'PUBLISHED' });

    await expect(JudgeService.revokeAssignment(wrongAssignmentId, 'admin-token'))
      .rejects.toThrow(/entered result publication/);

    expect(harness.documents.get('judgeAssignments/' + wrongAssignmentId)?.status).toBe('IN_PROGRESS');
    expect(harness.writes).toEqual([]);
  });

  it('requires a verified administrator identity before revocation', async () => {
    harness.assertAdmin.mockRejectedValueOnce(new Error('Unauthorized: ADMIN access required.'));

    await expect(JudgeService.revokeAssignment(wrongAssignmentId, 'not-admin'))
      .rejects.toThrow(/Unauthorized/);

    expect(harness.documents.get('judgeAssignments/' + wrongAssignmentId)?.status).toBe('IN_PROGRESS');
    expect(harness.writes).toEqual([]);
  });
});
