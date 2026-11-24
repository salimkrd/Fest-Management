/**
 * Shared validation for the judge's single total-mark input.
 * Empty text is allowed while a judge is still entering a mark; submitted values
 * must be whole numbers in the inclusive 0–100 range.
 */
export function isValidJudgeMarkText(value: string): boolean {
  return value === '' || (/^\d{1,3}$/.test(value) && Number(value) <= 100);
}

export function isValidJudgeTotalMark(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}
