import { randomInt } from 'node:crypto';
import { indexToCodeLetter, MAX_CODE_LETTER_INDEX } from '@/domain/greenRoom';

/**
 * Server-only: choose uniformly from unused codes in A..N, where N is the
 * count of APPROVED registrations in this competition (one per group).
 * Call inside the Firestore counter transaction to avoid duplicates.
 */
export function getRandomAvailableCodeLetter(
  usedCodes: Iterable<string>,
  approvedRegistrationCount: number,
  chooseIndex: (exclusiveUpperBound: number) => number = randomInt
): string {
  if (!Number.isSafeInteger(approvedRegistrationCount) || approvedRegistrationCount < 1) {
    throw new Error('Validation Error: No approved competition entries are available for code assignment.');
  }
  if (approvedRegistrationCount > MAX_CODE_LETTER_INDEX + 1) {
    throw new Error('Validation Error: Competition exceeds the supported code-letter capacity (A-ZZ).');
  }
  const occupied = new Set(Array.from(usedCodes, code => code.trim().toUpperCase()));
  const available = Array.from({ length: approvedRegistrationCount }, (_, index) => indexToCodeLetter(index))
    .filter(code => !occupied.has(code));
  if (!available.length) {
    throw new Error('Conflict Error: Every code letter for this competition has already been assigned.');
  }
  const selection = chooseIndex(available.length);
  if (!Number.isInteger(selection) || selection < 0 || selection >= available.length) {
    throw new Error('Security Error: Invalid random code-letter selection.');
  }
  return available[selection];
}
