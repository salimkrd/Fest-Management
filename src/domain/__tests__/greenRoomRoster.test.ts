import { describe, expect, it } from 'vitest';
import { buildGreenRoomRosterSnapshot } from '@/domain/greenRoomRoster';

const assignment = (
  registrationId: string,
  codeLetter: string,
  codeIndex: number,
  competitionId = 'cmp-roster-test'
) => ({
  id: `${competitionId}_${registrationId}`,
  data: {
    competitionId,
    registrationId,
    codeLetter,
    codeIndex,
    status: 'CHECKED_IN'
  }
});

describe('Green Room roster integrity', () => {
  it('builds a one-to-one Code Letter and registration mapping with a stable version', () => {
    const documents = [
      assignment('reg-2', 'B', 1),
      assignment('reg-1', 'A', 0)
    ];

    const first = buildGreenRoomRosterSnapshot('cmp-roster-test', documents);
    const second = buildGreenRoomRosterSnapshot('cmp-roster-test', [...documents].reverse());

    expect(first.entries.map(entry => entry.codeLetter)).toEqual(['A', 'B']);
    expect(first.codeToRegistration.get('A')).toBe('reg-1');
    expect(first.codeToRegistration.get('B')).toBe('reg-2');
    expect(first.registrationToCode.get('reg-1')?.codeLetter).toBe('A');
    expect(first.version).toMatch(/^[a-f0-9]{64}$/);
    expect(first.version).toBe(second.version);
  });

  it('fails closed when two registrations have the same Code Letter', () => {
    expect(() => buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'A', 0),
      assignment('reg-2', 'A', 0)
    ])).toThrow(/Code Letter "A" is assigned to more than one registration/);
  });

  it('rejects a non-canonical document claiming a second Code Letter for the same registration', () => {
    expect(() => buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'A', 0),
      {
        id: 'cmp-roster-test_reg-1-secondary',
        data: {
          competitionId: 'cmp-roster-test',
          registrationId: 'reg-1',
          codeLetter: 'B',
          codeIndex: 1
        }
      }
    ])).toThrow(/does not match its canonical registration mapping/);
  });

  it('rejects mismatched document IDs, competitions and code indexes', () => {
    expect(() => buildGreenRoomRosterSnapshot('cmp-roster-test', [
      {
        id: 'wrong-document-id',
        data: {
          competitionId: 'cmp-roster-test',
          registrationId: 'reg-1',
          codeLetter: 'A',
          codeIndex: 0
        }
      }
    ])).toThrow(/does not match its canonical registration mapping/);

    expect(() => buildGreenRoomRosterSnapshot('cmp-roster-test', [
      {
        id: 'cmp-other_reg-1',
        data: {
          competitionId: 'cmp-other',
          registrationId: 'reg-1',
          codeLetter: 'A',
          codeIndex: 0
        }
      }
    ])).toThrow(/belongs to a different competition/);

    expect(() => buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'B', 0)
    ])).toThrow(/inconsistent code index/);
  });

  it('changes the roster version whenever a Code Letter is mapped to another registration', () => {
    const original = buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'A', 0),
      assignment('reg-2', 'B', 1)
    ]);
    const reassigned = buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-2', 'A', 0),
      assignment('reg-1', 'B', 1)
    ]);

    expect(reassigned.version).not.toBe(original.version);
  });
});
