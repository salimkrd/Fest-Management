import { describe, it, expect } from 'vitest';
import {
  SAHITHYOLSAV_POINTS_MATRIX,
  calculateGradeFromPercentage,
  calculateGrade,
  getChampionshipPoints,
  evaluateCompetitionEntries,
  Grade,
  PrizePosition,
  CompetitionType,
  ScoredEntry
} from '../scoring';

describe('Sahithyolsav Championship Points Engine', () => {
  describe('All 40 Official Championship Points Combinations', () => {
    // Individual Competitions Matrix from PRD
    const expectedIndividual: Record<Grade, Record<1 | 2 | 3 | 'NO_PRIZE', number>> = {
      'A+': { 1: 11, 2: 9, 3: 7, NO_PRIZE: 6 },
      'A':  { 1: 10, 2: 8, 3: 6, NO_PRIZE: 5 },
      'B':  { 1: 8,  2: 6, 3: 4, NO_PRIZE: 3 },
      'C':  { 1: 6,  2: 4, 3: 2, NO_PRIZE: 1 },
      'NO_GRADE': { 1: 5, 2: 3, 3: 1, NO_PRIZE: 0 }
    };

    // Group Competitions Matrix from PRD
    const expectedGroup: Record<Grade, Record<1 | 2 | 3 | 'NO_PRIZE', number>> = {
      'A+': { 1: 23, 2: 21, 3: 19, NO_PRIZE: 18 },
      'A':  { 1: 20, 2: 18, 3: 16, NO_PRIZE: 15 },
      'B':  { 1: 15, 2: 13, 3: 11, NO_PRIZE: 10 },
      'C':  { 1: 10, 2: 8,  3: 6,  NO_PRIZE: 5 },
      'NO_GRADE': { 1: 5, 2: 3, 3: 1, NO_PRIZE: 0 }
    };

    const grades: Grade[] = ['A+', 'A', 'B', 'C', 'NO_GRADE'];
    const positions: (1 | 2 | 3 | 'NO_PRIZE')[] = [1, 2, 3, 'NO_PRIZE'];

    // 20 Individual Combinations
    grades.forEach(grade => {
      positions.forEach(pos => {
        const expectedPts = expectedIndividual[grade][pos];
        it(`SOLO: Grade ${grade} with position ${pos} must award exactly ${expectedPts} points`, () => {
          const inputPos: PrizePosition = pos === 'NO_PRIZE' ? null : pos;
          const actualPts = getChampionshipPoints('SOLO', grade, inputPos);
          expect(actualPts).toBe(expectedPts);
        });
      });
    });

    // 20 Group Combinations
    grades.forEach(grade => {
      positions.forEach(pos => {
        const expectedPts = expectedGroup[grade][pos];
        it(`GROUP: Grade ${grade} with position ${pos} must award exactly ${expectedPts} points`, () => {
          const inputPos: PrizePosition = pos === 'NO_PRIZE' ? null : pos;
          const actualPts = getChampionshipPoints('GROUP', grade, inputPos);
          expect(actualPts).toBe(expectedPts);
        });
      });
    });
  });

  describe('Grade Percentage Boundaries', () => {
    it('100% -> A+', () => {
      expect(calculateGradeFromPercentage(100)).toBe('A+');
    });

    it('90.0% -> A+ (Lower inclusive boundary of A+)', () => {
      expect(calculateGradeFromPercentage(90)).toBe('A+');
    });

    it('89.99% -> A (Upper exclusive boundary of A)', () => {
      expect(calculateGradeFromPercentage(89.99)).toBe('A');
    });

    it('70.0% -> A (Lower inclusive boundary of A)', () => {
      expect(calculateGradeFromPercentage(70)).toBe('A');
    });

    it('69.99% -> B (Upper exclusive boundary of B)', () => {
      expect(calculateGradeFromPercentage(69.99)).toBe('B');
    });

    it('60.0% -> B (Lower inclusive boundary of B)', () => {
      expect(calculateGradeFromPercentage(60)).toBe('B');
    });

    it('59.99% -> C (Upper exclusive boundary of C)', () => {
      expect(calculateGradeFromPercentage(59.99)).toBe('C');
    });

    it('50.0% -> C (Lower inclusive boundary of C)', () => {
      expect(calculateGradeFromPercentage(50)).toBe('C');
    });

    it('49.99% -> NO_GRADE (Below 50% cutoff)', () => {
      expect(calculateGradeFromPercentage(49.99)).toBe('NO_GRADE');
    });

    it('0% -> NO_GRADE', () => {
      expect(calculateGradeFromPercentage(0)).toBe('NO_GRADE');
    });

    it('Throws error on score exceeding 100% or below 0%', () => {
      expect(() => calculateGradeFromPercentage(101)).toThrow();
      expect(() => calculateGradeFromPercentage(-1)).toThrow();
    });

    it('calculateGrade calculates percentage from custom maxMarks correctly', () => {
      // 45 out of 50 = 90% -> A+
      expect(calculateGrade(45, 50)).toBe('A+');
      // 35 out of 50 = 70% -> A
      expect(calculateGrade(35, 50)).toBe('A');
      // 24 out of 50 = 48% -> NO_GRADE
      expect(calculateGrade(24, 50)).toBe('NO_GRADE');
    });
  });

  describe('No Prize Point Allocation', () => {
    it('awards 6 points for a non-winning participant with Grade A+ in SOLO', () => {
      const points = getChampionshipPoints('SOLO', 'A+', null);
      expect(points).toBe(6);
    });

    it('awards 18 points for a non-winning group entry with Grade A+ in GROUP', () => {
      const points = getChampionshipPoints('GROUP', 'A+', null);
      expect(points).toBe(18);
    });

    it('awards 0 points for a non-winning participant with NO_GRADE', () => {
      expect(getChampionshipPoints('SOLO', 'NO_GRADE', null)).toBe(0);
      expect(getChampionshipPoints('GROUP', 'NO_GRADE', null)).toBe(0);
    });
  });

  describe('Group Competition Single-Award Rule', () => {
    it('awards group competition points once per group entry regardless of member count', () => {
      const groupEntry: ScoredEntry = {
        registrationId: 'reg-grp-1',
        bib: 'GRP-101',
        teamId: 'team-1',
        teamCode: 'ABH',
        candidateName: 'Al-Bayan Qawwali Troupe (8 members)',
        score: 95,
        maxMarks: 100,
        position: 1
      };

      const results = evaluateCompetitionEntries('GROUP', [groupEntry]);
      expect(results[0].officialPoints).toBe(23); // Exactly 23 points, NOT 23 * 8
    });
  });

  describe('Tie Evaluation', () => {
    it('does not invent artificial tie-breakers; evaluates according to position & grade', () => {
      const entries: ScoredEntry[] = [
        {
          registrationId: 'reg-1',
          bib: '101',
          teamId: 'team-1',
          teamCode: 'ABH',
          candidateName: 'Candidate A',
          score: 92,
          position: 1
        },
        {
          registrationId: 'reg-2',
          bib: '102',
          teamId: 'team-2',
          teamCode: 'BSH',
          candidateName: 'Candidate B (Tied 1st)',
          score: 92,
          position: 1
        }
      ];

      const evaluated = evaluateCompetitionEntries('SOLO', entries);
      expect(evaluated[0].officialPoints).toBe(11);
      expect(evaluated[1].officialPoints).toBe(11);
    });
  });
});
