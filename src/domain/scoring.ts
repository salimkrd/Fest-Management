/**
 * Sahithyolsav Championship Scoring & Tabulation Domain Engine
 * 
 * Implements the exact official Sahithyolsav points matrix.
 * No separate additive bonuses; points are derived purely from the matrix
 * lookup of (CompetitionType, Grade, Position).
 */

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'NO_GRADE';
export type PrizePosition = 1 | 2 | 3 | 'NO_PRIZE' | null;
export type CompetitionType = 'SOLO' | 'GROUP';

export type NormalizedPosition = 1 | 2 | 3 | 'NO_PRIZE';

/**
 * Official Sahithyolsav Points Matrix (2 x 5 x 4 = 40 combinations)
 */
export const SAHITHYOLSAV_POINTS_MATRIX: Record<
  CompetitionType,
  Record<Grade, Record<NormalizedPosition, number>>
> = {
  SOLO: {
    'A+': { 1: 11, 2: 9, 3: 7, NO_PRIZE: 6 },
    'A':  { 1: 10, 2: 8, 3: 6, NO_PRIZE: 5 },
    'B':  { 1: 8,  2: 6, 3: 4, NO_PRIZE: 3 },
    'C':  { 1: 6,  2: 4, 3: 2, NO_PRIZE: 1 },
    'NO_GRADE': { 1: 5, 2: 3, 3: 1, NO_PRIZE: 0 }
  },
  GROUP: {
    'A+': { 1: 23, 2: 21, 3: 19, NO_PRIZE: 18 },
    'A':  { 1: 20, 2: 18, 3: 16, NO_PRIZE: 15 },
    'B':  { 1: 15, 2: 13, 3: 11, NO_PRIZE: 10 },
    'C':  { 1: 10, 2: 8,  3: 6,  NO_PRIZE: 5 },
    'NO_GRADE': { 1: 5, 2: 3, 3: 1, NO_PRIZE: 0 }
  }
};

/**
 * Normalizes prize position into a valid matrix lookup key.
 */
export function normalizePosition(position: PrizePosition): NormalizedPosition {
  if (position === 1 || position === 2 || position === 3) {
    return position;
  }
  return 'NO_PRIZE';
}

/**
 * Calculates grade from percentage based on official Sahithyolsav grade boundaries:
 * - A+: 90–100%
 * - A:  70–below 90%
 * - B:  60–below 70%
 * - C:  50–below 60%
 * - No Grade: Below 50%
 */
export function calculateGradeFromPercentage(percentage: number): Grade {
  if (isNaN(percentage)) {
    return 'NO_GRADE';
  }
  if (percentage < 0) {
    throw new Error(`Invalid percentage: ${percentage}. Percentage cannot be negative.`);
  }
  if (percentage > 100) {
    throw new Error(`Invalid percentage: ${percentage}. Percentage cannot exceed 100.`);
  }

  // Exact boundary evaluation
  if (percentage >= 90) {
    return 'A+';
  }
  if (percentage >= 70) {
    return 'A';
  }
  if (percentage >= 60) {
    return 'B';
  }
  if (percentage >= 50) {
    return 'C';
  }
  return 'NO_GRADE';
}

/**
 * Helper to compute grade from raw score and maximum possible marks.
 */
export function calculateGrade(score: number, maxMarks: number = 100): Grade {
  if (maxMarks <= 0) {
    throw new Error('maxMarks must be greater than zero.');
  }
  if (score < 0 || score > maxMarks) {
    throw new Error(`Score (${score}) must be between 0 and maxMarks (${maxMarks}).`);
  }
  const percentage = (score / maxMarks) * 100;
  return calculateGradeFromPercentage(percentage);
}

/**
 * Looks up official championship points from the Sahithyolsav matrix.
 * 
 * Rules:
 * - Exact matrix lookup.
 * - No separate grade bonuses added.
 * - "No Prize" entries with eligible grades (A+, A, B, C) receive points.
 * - Group entries receive the matrix group points once per group entry (never multiplied by group size).
 */
export function getChampionshipPoints(
  competitionType: CompetitionType,
  grade: Grade,
  position: PrizePosition
): number {
  const normalizedPos = normalizePosition(position);
  const typeMatrix = SAHITHYOLSAV_POINTS_MATRIX[competitionType];
  if (!typeMatrix) {
    throw new Error(`Invalid competition type: ${competitionType}`);
  }
  const gradeRow = typeMatrix[grade];
  if (!gradeRow) {
    throw new Error(`Invalid grade: ${grade}`);
  }
  const points = gradeRow[normalizedPos];
  if (points === undefined) {
    throw new Error(`Missing points entry for (${competitionType}, ${grade}, ${normalizedPos})`);
  }
  return points;
}

/**
 * Domain representation of an entry evaluated for championship points.
 */
export interface ScoredEntry {
  registrationId: string;
  bib: string;
  teamId: string;
  teamCode: string;
  candidateName: string;
  score: number;
  maxMarks?: number;
  position: PrizePosition; // 1 | 2 | 3 | null | 'NO_PRIZE'
  grade?: Grade;           // If not provided, computed from score & maxMarks
}

export interface EvaluatedEntry extends ScoredEntry {
  grade: Grade;
  percentage: number;
  normalizedPosition: NormalizedPosition;
  officialPoints: number;
}

/**
 * Evaluates an entire list of scored entries for a competition.
 * Does NOT invent arbitrary tie-breaking rules. If two participants have equal
 * marks and assigned ranks, each receives points according to their position and grade.
 */
export function evaluateCompetitionEntries(
  competitionType: CompetitionType,
  entries: ScoredEntry[],
  defaultMaxMarks: number = 100
): EvaluatedEntry[] {
  return entries.map(entry => {
    const maxMarks = entry.maxMarks ?? defaultMaxMarks;
    const percentage = Number(((entry.score / maxMarks) * 100).toFixed(2));
    const grade = entry.grade ?? calculateGradeFromPercentage(percentage);
    const normalizedPosition = normalizePosition(entry.position);
    const officialPoints = getChampionshipPoints(competitionType, grade, entry.position);

    return {
      ...entry,
      grade,
      percentage,
      normalizedPosition,
      officialPoints
    };
  });
}
