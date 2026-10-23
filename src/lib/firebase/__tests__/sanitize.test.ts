import { describe, it, expect } from 'vitest';
import { sanitizeForFirestore } from '../sanitize';

describe('sanitizeForFirestore', () => {
  it('strips top-level undefined fields', () => {
    const input = {
      name: 'Salim',
      remarks: undefined,
      score: 100,
      active: true
    };
    const output = sanitizeForFirestore(input);
    expect(output).toEqual({
      name: 'Salim',
      score: 100,
      active: true
    });
    expect('remarks' in output).toBe(false);
  });

  it('strips nested undefined fields recursively', () => {
    const input = {
      id: 'p-1',
      profile: {
        bio: 'Student',
        notes: undefined
      },
      tags: ['a', undefined, 'b']
    };
    const output = sanitizeForFirestore(input);
    expect(output).toEqual({
      id: 'p-1',
      profile: {
        bio: 'Student'
      },
      tags: ['a', 'b']
    });
  });

  it('preserves Date, null, boolean, and empty strings', () => {
    const now = new Date();
    const input = {
      date: now,
      nullVal: null,
      emptyStr: '',
      zero: 0,
      falsy: false
    };
    const output = sanitizeForFirestore(input);
    expect(output.date).toBe(now);
    expect(output.nullVal).toBeNull();
    expect(output.emptyStr).toBe('');
    expect(output.zero).toBe(0);
    expect(output.falsy).toBe(false);
  });
});
