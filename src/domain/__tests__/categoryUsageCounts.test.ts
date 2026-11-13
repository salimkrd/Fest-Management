import { describe, expect, it } from 'vitest';
import type { Category, Competition, Participant } from '@/types/fest';
import { buildCategoryUsageCounts } from '../categoryUsageCounts';

const category = (id: string, name: string, code: string): Category => ({
  id,
  name,
  code,
  eligibility: '',
  ageRange: '',
  classRange: '',
  enrolledCount: 0,
  competitionsCount: 0,
  status: 'ACTIVE'
});

const participant = (overrides: Partial<Participant> = {}): Participant => ({
  id: 'participant-1',
  bib: '#1001',
  name: 'Test Participant',
  email: '',
  phone: '',
  teamId: 'team-1',
  teamCode: 'T1',
  teamName: 'Team 1',
  categoryId: '',
  categoryName: '',
  classGrade: '',
  dob: '',
  photoUrl: '',
  registeredEventIds: [],
  idStatus: 'GENERATED',
  ...overrides
});

const competition = (overrides: Partial<Competition> = {}): Competition => ({
  id: 'competition-1',
  code: 'CMP-01',
  name: 'Test Competition',
  categoryId: '',
  categoryName: '',
  type: 'SOLO',
  entriesCount: 0,
  stageId: '',
  stageName: '',
  assignedJudges: [],
  status: 'SCHEDULED',
  date: '',
  timeSlot: '',
  durationMinutes: 60,
  maxEntriesPerTeam: 1,
  criteria: [],
  ...overrides
});

describe('category usage counters', () => {
  const categories = [
    category('cat-alpha', 'Alpha', 'ALP'),
    category('cat-beta', 'Beta', 'BET'),
    { ...category('cat-general', 'General', 'GEN'), participantEligibility: 'OPEN_TO_ALL' as const }
  ];

  it('counts enrolled participant records by their assigned category, not event registrations', () => {
    const counts = buildCategoryUsageCounts(
      categories,
      [
        participant({ id: 'p1', categoryId: 'cat-alpha', registeredEventIds: ['cmp-1', 'cmp-2'] }),
        participant({ id: 'p2', categoryId: 'cat-alpha' }),
        participant({ id: 'p3', categoryId: 'cat-beta' })
      ],
      []
    );

    expect(counts.get('cat-alpha')?.participants).toBe(2);
    expect(counts.get('cat-beta')?.participants).toBe(1);
    // Open-to-all eligibility does not mean every participant is enrolled in General.
    expect(counts.get('cat-general')?.participants).toBe(0);
  });

  it('counts each configured competition assigned to the category once', () => {
    const counts = buildCategoryUsageCounts(
      categories,
      [],
      [
        competition({ id: 'c1', categoryId: 'cat-alpha' }),
        competition({ id: 'c2', categoryId: 'cat-alpha' }),
        competition({ id: 'c3', categoryId: 'cat-beta' })
      ]
    );

    expect(counts.get('cat-alpha')?.competitions).toBe(2);
    expect(counts.get('cat-beta')?.competitions).toBe(1);
    expect(counts.get('cat-general')?.competitions).toBe(0);
  });

  it('supports legacy records that have a category name or exact tier code but no category ID', () => {
    const counts = buildCategoryUsageCounts(
      categories,
      [
        participant({ id: 'legacy-name', categoryName: ' Alpha ' }),
        participant({ id: 'legacy-code', classGrade: 'BET' })
      ],
      [
        competition({ id: 'legacy-competition', categoryName: ' alpha ' })
      ]
    );

    expect(counts.get('cat-alpha')?.participants).toBe(1);
    expect(counts.get('cat-beta')?.participants).toBe(1);
    expect(counts.get('cat-alpha')?.competitions).toBe(1);
  });

  it('treats a present category ID as authoritative over a stale name', () => {
    const counts = buildCategoryUsageCounts(
      categories,
      [participant({ categoryId: 'cat-beta', categoryName: 'Alpha' })],
      [competition({ categoryId: 'cat-beta', categoryName: 'Alpha' })]
    );

    expect(counts.get('cat-alpha')?.participants).toBe(0);
    expect(counts.get('cat-beta')?.participants).toBe(1);
    expect(counts.get('cat-alpha')?.competitions).toBe(0);
    expect(counts.get('cat-beta')?.competitions).toBe(1);
  });
});
