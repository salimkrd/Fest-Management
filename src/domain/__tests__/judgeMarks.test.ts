import { describe, expect, it } from 'vitest';
import { isValidJudgeMarkText, isValidJudgeTotalMark } from '@/domain/judgeMarks';

describe('judge total mark validation', () => {
  it('allows an empty field while a judge is still entering a mark', () => {
    expect(isValidJudgeMarkText('')).toBe(true);
  });

  it('accepts whole-number marks from 0 through 100', () => {
    for (const value of ['0', '1', '25', '99', '100']) {
      expect(isValidJudgeMarkText(value)).toBe(true);
      expect(isValidJudgeTotalMark(Number(value))).toBe(true);
    }
  });

  it('rejects values above 100 and non-integer input', () => {
    for (const value of ['101', '999', '1000', '-1', '1.5', '1e2', 'abc']) {
      expect(isValidJudgeMarkText(value)).toBe(false);
    }
    for (const value of [101, 1000, -1, 1.5, NaN, Infinity, '100']) {
      expect(isValidJudgeTotalMark(value)).toBe(false);
    }
  });
});
