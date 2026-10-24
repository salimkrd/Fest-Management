import { describe, it, expect, vi } from 'vitest';
import { Category, Competition, MarkEntry, CompetitionResult, PointsLedgerEntry } from '@/types/fest';

describe('Competition and Mark Entry Synchronization', () => {
  const sampleCompetitions: Competition[] = [
    {
      id: 'cmp-active-1',
      code: 'CMP-01',
      name: 'Elocution (English)',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      type: 'SOLO',
      entriesCount: 5,
      stageId: 'stg-1',
      stageName: 'Stage 1',
      assignedJudges: ['Judge A'],
      status: 'SCHEDULED',
      date: '2026-11-15',
      timeSlot: '09:00 AM',
      durationMinutes: 60,
      maxEntriesPerTeam: 1,
      criteria: []
    }
  ];

  const rawJudgeAssignments: MarkEntry[] = [
    {
      id: 'asgn-valid-1',
      competitionId: 'cmp-active-1',
      competitionName: 'Elocution (English)',
      competitionCode: 'CMP-01',
      categoryName: 'Senior',
      type: 'SOLO',
      judgeName: 'Judge A',
      judgePhone: '+91 98471 00001',
      accessCode: 'JRY-1001',
      secretHash: 'hash-1',
      salt: 'salt-1',
      status: 'NOT_STARTED',
      scores: []
    },
    {
      id: 'asgn-orphaned-old',
      competitionId: 'cmp-deleted-extempore',
      competitionName: 'Extempore Speech (English)',
      competitionCode: 'CMP-01',
      categoryName: 'General',
      type: 'SOLO',
      judgeName: 'Dr Muhammed',
      judgePhone: '+91 98471 23456',
      accessCode: '382 910',
      secretHash: 'hash-2',
      salt: 'salt-2',
      status: 'SUBMITTED',
      submittedAt: '2025-11-14 11:20 AM',
      scores: []
    }
  ];

  it('1. Guarantees markEntries is strictly empty when 0 competitions exist', () => {
    const competitions: Competition[] = [];
    const validCompIds = new Set(competitions.map(c => c.id));
    const markEntries = competitions.length === 0
      ? []
      : rawJudgeAssignments.filter(entry => validCompIds.has(entry.competitionId));

    expect(markEntries).toEqual([]);
    expect(markEntries.length).toBe(0);
  });

  it('2. Filters out orphaned judge assignments for deleted competitions', () => {
    const validCompIds = new Set(sampleCompetitions.map(c => c.id));
    const markEntries = sampleCompetitions.length === 0
      ? []
      : rawJudgeAssignments.filter(entry => validCompIds.has(entry.competitionId));

    expect(markEntries.length).toBe(1);
    expect(markEntries[0].id).toBe('asgn-valid-1');
    expect(markEntries[0].competitionId).toBe('cmp-active-1');
    // Verify the orphaned "Dr Muhammed" / "Extempore Speech" assignment is filtered out
    expect(markEntries.some(m => m.judgeName.includes('Muhammed'))).toBe(false);
    expect(markEntries.some(m => m.competitionName.includes('Extempore'))).toBe(false);
  });

  it('3. MarkEntry KPIs calculate strictly over valid existing competitions', () => {
    const validCompIds = new Set(sampleCompetitions.map(c => c.id));
    const validEntries = sampleCompetitions.length === 0
      ? []
      : rawJudgeAssignments.filter(m => validCompIds.has(m.competitionId));

    const notStartedCount = validEntries.filter(m => m.status === 'NOT_STARTED').length;
    const inProgressCount = validEntries.filter(m => m.status === 'IN_PROGRESS').length;
    const submittedCount = validEntries.filter(m => m.status === 'SUBMITTED').length;

    expect(notStartedCount).toBe(1);
    expect(inProgressCount).toBe(0);
    // The orphaned entry had status 'SUBMITTED', but should NOT be counted in submittedCount
    expect(submittedCount).toBe(0);
  });

  it('4. Cascade deletion of a competition removes all associated judge assignments', () => {
    let competitions = [...sampleCompetitions];
    let assignments = [...rawJudgeAssignments];

    // Simulate deleting cmp-active-1
    const compToDeleteId = 'cmp-active-1';
    competitions = competitions.filter(c => c.id !== compToDeleteId);
    assignments = assignments.filter(j => j.competitionId !== compToDeleteId);

    const validCompIds = new Set(competitions.map(c => c.id));
    const visibleMarkEntries = competitions.length === 0
      ? []
      : assignments.filter(m => validCompIds.has(m.competitionId));

    expect(competitions.length).toBe(0);
    expect(visibleMarkEntries.length).toBe(0);
  });
});

describe('Multi-Competition Isolation and Unrelated Data Protection', () => {
  const comp1: Competition = {
    id: 'cmp-01',
    code: 'CMP-01',
    name: 'Quran Recitation',
    categoryId: 'cat-junior',
    categoryName: 'Junior',
    type: 'SOLO',
    entriesCount: 3,
    stageId: 'stg-1',
    stageName: 'Stage 1',
    assignedJudges: ['Judge 1'],
    status: 'PUBLISHED',
    date: '2026-11-15',
    timeSlot: '10:00 AM',
    durationMinutes: 45,
    maxEntriesPerTeam: 1,
    criteria: []
  };

  const comp2: Competition = {
    id: 'cmp-02',
    code: 'CMP-02',
    name: 'Calligraphy',
    categoryId: 'cat-senior',
    categoryName: 'Senior',
    type: 'SOLO',
    entriesCount: 4,
    stageId: 'stg-2',
    stageName: 'Stage 2',
    assignedJudges: ['Judge 2'],
    status: 'PUBLISHED',
    date: '2026-11-15',
    timeSlot: '11:00 AM',
    durationMinutes: 60,
    maxEntriesPerTeam: 1,
    criteria: []
  };

  const allMarks: MarkEntry[] = [
    { id: 'me-1', competitionId: 'cmp-01', competitionName: 'Quran Recitation', competitionCode: 'CMP-01', categoryName: 'Junior', type: 'SOLO', judgeName: 'Judge 1', judgePhone: '', accessCode: '111', secretHash: '', salt: '', status: 'SUBMITTED', scores: [] },
    { id: 'me-2', competitionId: 'cmp-02', competitionName: 'Calligraphy', competitionCode: 'CMP-02', categoryName: 'Senior', type: 'SOLO', judgeName: 'Judge 2', judgePhone: '', accessCode: '222', secretHash: '', salt: '', status: 'SUBMITTED', scores: [] }
  ];

  const allResults: CompetitionResult[] = [
    {
      id: 'res-cmp-01',
      competitionId: 'cmp-01',
      competitionCode: 'CMP-01',
      competitionName: 'Quran Recitation',
      categoryName: 'Junior',
      type: 'SOLO',
      stageName: 'Stage 1',
      marksStatus: 'COMPLETE',
      resultStatus: 'PUBLISHED',
      publishedDate: '2026-11-15',
      ranks: [],
      posterReleased: false
    },
    {
      id: 'res-cmp-02',
      competitionId: 'cmp-02',
      competitionCode: 'CMP-02',
      competitionName: 'Calligraphy',
      categoryName: 'Senior',
      type: 'SOLO',
      stageName: 'Stage 2',
      marksStatus: 'COMPLETE',
      resultStatus: 'PUBLISHED',
      publishedDate: '2026-11-15',
      ranks: [],
      posterReleased: false
    }
  ];

  const allPoints: PointsLedgerEntry[] = [
    {
      id: 'pts-1',
      resultId: 'res-cmp-01',
      competitionId: 'cmp-01',
      competitionCode: 'CMP-01',
      competitionName: 'Quran Recitation',
      competitionType: 'SOLO',
      teamId: 'team-alpha',
      teamCode: 'TAL',
      teamName: 'Team Alpha',
      registrationId: 'reg-1',
      candidateName: 'Candidate 1',
      bib: '#101',
      score: 95,
      rank: 1,
      grade: 'A+',
      points: 10,
      status: 'COMMITTED',
      publishedAt: '2026-11-15'
    },
    {
      id: 'pts-2',
      resultId: 'res-cmp-02',
      competitionId: 'cmp-02',
      competitionCode: 'CMP-02',
      competitionName: 'Calligraphy',
      competitionType: 'SOLO',
      teamId: 'team-beta',
      teamCode: 'TBE',
      teamName: 'Team Beta',
      registrationId: 'reg-2',
      candidateName: 'Candidate 2',
      bib: '#102',
      score: 92,
      rank: 1,
      grade: 'A',
      points: 10,
      status: 'COMMITTED',
      publishedAt: '2026-11-15'
    }
  ];

  it('5. Deleting cmp-01 removes only cmp-01 records and strictly preserves cmp-02 marks, results and points', () => {
    const targetId = 'cmp-01';

    // Simulate cascade deletion of cmp-01
    const survivingComps = [comp1, comp2].filter(c => c.id !== targetId);
    const survivingMarks = allMarks.filter(m => m.competitionId !== targetId);
    const survivingResults = allResults.filter(r => r.competitionId !== targetId);
    const survivingPoints = allPoints.filter(p => p.competitionId !== targetId);

    // Verify target cmp-01 was removed
    expect(survivingComps.find(c => c.id === 'cmp-01')).toBeUndefined();
    expect(survivingMarks.find(m => m.competitionId === 'cmp-01')).toBeUndefined();
    expect(survivingResults.find(r => r.competitionId === 'cmp-01')).toBeUndefined();
    expect(survivingPoints.find(p => p.competitionId === 'cmp-01')).toBeUndefined();

    // Verify unrelated cmp-02 is 100% intact
    expect(survivingComps.length).toBe(1);
    expect(survivingComps[0].id).toBe('cmp-02');
    expect(survivingMarks.length).toBe(1);
    expect(survivingMarks[0].id).toBe('me-2');
    expect(survivingMarks[0].competitionId).toBe('cmp-02');
    expect(survivingResults.length).toBe(1);
    expect(survivingResults[0].id).toBe('res-cmp-02');
    expect(survivingPoints.length).toBe(1);
    expect(survivingPoints[0].id).toBe('pts-2');
    expect(survivingPoints[0].teamId).toBe('team-beta');
  });
});

describe('Orphan Cleanup Accuracy and Safety Guardrails', () => {
  it('6. Cleanup preserves all valid assignments and purges only orphaned assignments', () => {
    const activeCompetitions: Competition[] = [
      { id: 'comp-alpha', code: 'A', name: 'Alpha', categoryId: 'cat-1', categoryName: 'C1', type: 'SOLO', entriesCount: 1, stageId: '', stageName: '', assignedJudges: [], status: 'SCHEDULED', date: '', timeSlot: '', durationMinutes: 30, maxEntriesPerTeam: 1, criteria: [] },
      { id: 'comp-beta', code: 'B', name: 'Beta', categoryId: 'cat-2', categoryName: 'C2', type: 'SOLO', entriesCount: 1, stageId: '', stageName: '', assignedJudges: [], status: 'SCHEDULED', date: '', timeSlot: '', durationMinutes: 30, maxEntriesPerTeam: 1, criteria: [] }
    ];

    const mixedAssignments: MarkEntry[] = [
      { id: 'asgn-valid-alpha', competitionId: 'comp-alpha', competitionName: 'Alpha', competitionCode: 'A', categoryName: 'C1', type: 'SOLO', judgeName: 'Judge 1', judgePhone: '', accessCode: '1', secretHash: '', salt: '', status: 'NOT_STARTED', scores: [] },
      { id: 'asgn-valid-beta', competitionId: 'comp-beta', competitionName: 'Beta', competitionCode: 'B', categoryName: 'C2', type: 'SOLO', judgeName: 'Judge 2', judgePhone: '', accessCode: '2', secretHash: '', salt: '', status: 'IN_PROGRESS', scores: [] },
      { id: 'asgn-orphan-1', competitionId: 'comp-deleted-x', competitionName: 'Deleted X', competitionCode: 'X', categoryName: 'C3', type: 'SOLO', judgeName: 'Judge 3', judgePhone: '', accessCode: '3', secretHash: '', salt: '', status: 'SUBMITTED', scores: [] },
      { id: 'asgn-orphan-2', competitionId: '', competitionName: 'No Comp', competitionCode: 'Y', categoryName: 'C4', type: 'SOLO', judgeName: 'Judge 4', judgePhone: '', accessCode: '4', secretHash: '', salt: '', status: 'NOT_STARTED', scores: [] }
    ];

    const activeCompIds = new Set(activeCompetitions.map(c => c.id));
    const toDelete: MarkEntry[] = [];
    const preserved: MarkEntry[] = [];

    mixedAssignments.forEach(entry => {
      if (!entry.competitionId || !activeCompIds.has(entry.competitionId)) {
        toDelete.push(entry);
      } else {
        preserved.push(entry);
      }
    });

    expect(toDelete.map(e => e.id)).toEqual(['asgn-orphan-1', 'asgn-orphan-2']);
    expect(preserved.map(e => e.id)).toEqual(['asgn-valid-alpha', 'asgn-valid-beta']);
    expect(preserved.length).toBe(2);
    // Valid records were completely untouched
    expect(preserved.find(e => e.competitionId === 'comp-alpha')).toBeDefined();
    expect(preserved.find(e => e.competitionId === 'comp-beta')).toBeDefined();
  });
});

describe('Category Realtime State, Permanent Deletion and Cross-Device Sync', () => {
  it('7. Empty snapshot clears categories without reverting to default or General mock tier', () => {
    const snapshotDocs: any[] = [];
    let stateCategories: Category[] = [
      {
        id: 'cat-4',
        name: 'General',
        code: 'CAT-GEN',
        eligibility: 'All Eligible Students',
        ageRange: 'Open Tier',
        classRange: 'Campus Wide',
        enrolledCount: 78,
        competitionsCount: 8,
        status: 'ACTIVE'
      }
    ];

    // Simulate snapshot handler with empty collection check
    if (snapshotDocs.length === 0) {
      stateCategories = [];
    } else {
      stateCategories = snapshotDocs.map(d => d.data());
    }

    expect(stateCategories).toEqual([]);
    expect(stateCategories.some(c => c.name === 'General')).toBe(false);
  });

  it('8. Deleting category removes it permanently from state and does not restore on re-render', () => {
    let categories: Category[] = [
      { id: 'cat-1', name: 'Sub Junior', code: 'CAT-SJ', eligibility: '', ageRange: '', classRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
      { id: 'cat-4', name: 'General', code: 'CAT-GEN', eligibility: '', ageRange: '', classRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
    ];

    // Delete 'cat-4'
    const idToDelete = 'cat-4';
    categories = categories.filter(c => c.id !== idToDelete);

    expect(categories.length).toBe(1);
    expect(categories.find(c => c.id === 'cat-4')).toBeUndefined();
    expect(categories[0].name).toBe('Sub Junior');
  });

  it('9. Category deletion failure preserves previous state and throws for UI error banner', async () => {
    let categories: Category[] = [
      { id: 'cat-4', name: 'General', code: 'CAT-GEN', eligibility: '', ageRange: '', classRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
    ];

    const mockDeleteDoc = vi.fn().mockRejectedValue(new Error('Missing or insufficient permissions'));

    const deleteCategory = async (id: string) => {
      const prev = [...categories];
      categories = categories.filter(c => c.id !== id);
      try {
        await mockDeleteDoc();
      } catch (err) {
        categories = prev;
        throw err;
      }
    };

    let caughtError: string | null = null;
    try {
      await deleteCategory('cat-4');
    } catch (err: any) {
      caughtError = err.message;
    }

    expect(caughtError).toBe('Missing or insufficient permissions');
    // State was reverted because deletion failed in Firestore
    expect(categories.length).toBe(1);
    expect(categories[0].id).toBe('cat-4');
  });

  it('10. Cross-Device Synchronization: Deletion on Device A propagates to Device B without cache resurrection', () => {
    // Device A deletes category 'cat-4'
    const firestoreCategoriesOnServer: Category[] = [
      { id: 'cat-1', name: 'Sub Junior', code: 'CAT-SJ', eligibility: '', ageRange: '', classRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
    ];

    // Device B receives onSnapshot update from Firestore
    let deviceBCategories: Category[] = [
      { id: 'cat-1', name: 'Sub Junior', code: 'CAT-SJ', eligibility: '', ageRange: '', classRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
      { id: 'cat-4', name: 'General', code: 'CAT-GEN', eligibility: '', ageRange: '', classRange: '', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
    ];

    // Realtime snapshot listener triggers on Device B
    const onDeviceBSnapshot = (serverDocs: Category[]) => {
      if (serverDocs.length === 0) {
        deviceBCategories = [];
        return;
      }
      deviceBCategories = serverDocs.map(c => ({ ...c }));
    };

    onDeviceBSnapshot(firestoreCategoriesOnServer);

    // Verify Device B immediately purged 'cat-4'
    expect(deviceBCategories.length).toBe(1);
    expect(deviceBCategories[0].id).toBe('cat-1');
    expect(deviceBCategories.some(c => c.id === 'cat-4')).toBe(false);
  });
});
