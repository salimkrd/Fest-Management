import { describe, it, expect } from 'vitest';
import { getRandomAvailableCodeLetter } from '@/services/greenRoomCodeAllocator';

describe('Random Green Room Code Letters', () => {
  it('permits every letter A-C as the FIRST code with 3 approved entries', () => {
    expect([0, 1, 2].map(i => getRandomAvailableCodeLetter([], 3, () => i))).toEqual(['A', 'B', 'C']);
  });
  it('permits every letter A-E as the FIRST code with 5 approved entries', () => {
    expect([0, 1, 2, 3, 4].map(i => getRandomAvailableCodeLetter([], 5, () => i))).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it('excludes previously assigned letters and fills the pool without collisions', () => {
    expect(getRandomAvailableCodeLetter(['A', 'D'], 5, () => 0)).toBe('B');
    expect(getRandomAvailableCodeLetter(['A', 'D'], 5, () => 1)).toBe('C');
    expect(getRandomAvailableCodeLetter(['A', 'D'], 5, () => 2)).toBe('E');
    expect(() => getRandomAvailableCodeLetter(['A', 'B', 'C'], 3)).toThrow(/already been assigned/);
  });
  it('supports codes AA..ZZ and rejects invalid competition sizes', () => {
    expect(getRandomAvailableCodeLetter([], 27, () => 26)).toBe('AA');
    expect(getRandomAvailableCodeLetter([], 702, () => 701)).toBe('ZZ');
    expect(() => getRandomAvailableCodeLetter([], 703)).toThrow(/capacity/);
    expect(() => getRandomAvailableCodeLetter([], 0)).toThrow(/No approved/);
  });
});
