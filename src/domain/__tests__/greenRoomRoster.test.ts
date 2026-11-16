import { describe, expect, it } from 'vitest';
import {
  buildGreenRoomRosterSnapshot,
  assertGreenRoomEntryMatchesRegistration
} from '@/domain/greenRoomRoster';

const assignment = (
  registrationId: string,
  codeLetter: string,
  codeIndex: number,
  competitionId = 'cmp-roster-test',
  identity: Record<string, unknown> = {}
) => ({
  id: `${competitionId}_${registrationId}`,
  data: {
    competitionId,
    registrationId,
    codeLetter,
    codeIndex,
    status: 'CHECKED_IN',
    participantId: `part-${registrationId}`,
    participantName: `Contestant ${registrationId}`,
    ...identity
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
    ])).toThrow(/does not match its canonical registration record/);
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
    ])).toThrow(/does not match its canonical registration record/);

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

  it('verifies the stored participant, team, chest and group identity against the live registration', () => {
    const identity = {
      id: 'reg-1',
      competitionId: 'cmp-roster-test',
      participantId: 'part-1',
      participantName: 'Student One',
      teamId: 'team-1',
      teamCode: 'SHA',
      teamName: 'Team Shamama',
      chestNumber: '101',
      groupMembers: ['part-1', 'part-2'],
      groupLeaderId: 'part-1',
      groupSize: 2
    };
    const roster = buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'A', 0, 'cmp-roster-test', identity)
    ]);
    const entry = roster.entries[0];

    expect(() => assertGreenRoomEntryMatchesRegistration(entry, {
      ...identity,
      teamCode: 'sha',
      chestNumber: '101',
      groupMembers: ['part-2', 'part-1']
    })).not.toThrow();

    expect(() => assertGreenRoomEntryMatchesRegistration(entry, {
      ...identity,
      participantId: 'part-reassigned'
    })).toThrow(/participant and group identity snapshot/);

    expect(() => assertGreenRoomEntryMatchesRegistration(entry, {
      ...identity,
      participantName: 'Different Student'
    })).toThrow(/participant and group identity snapshot/);

    expect(() => assertGreenRoomEntryMatchesRegistration(entry, {
      ...identity,
      groupMembers: ['part-1']
    })).toThrow(/participant and group identity snapshot/);

    expect(() => assertGreenRoomEntryMatchesRegistration(entry, {
      ...identity,
      teamName: 'A Different Team'
    })).toThrow(/participant and group identity snapshot/);
  });

  it('fails closed when a Code Letter has no stable participant or group identity', () => {
    expect(() => buildGreenRoomRosterSnapshot('cmp-roster-test', [
      {
        id: 'cmp-roster-test_reg-anonymous',
        data: {
          competitionId: 'cmp-roster-test',
          registrationId: 'reg-anonymous',
          codeLetter: 'A',
          codeIndex: 0,
          status: 'CHECKED_IN'
        }
      }
    ])).toThrow(/no verifiable participant or group identity/);
  });

  it('changes the roster version if the registration identity changes even when Code Letter and registration ID stay the same', () => {
    const original = buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'A', 0, 'cmp-roster-test', {
        participantId: 'part-original',
        participantName: 'Original Student',
        teamId: 'team-1',
        teamCode: 'SHA',
        chestNumber: '101'
      })
    ]);
    const identityChanged = buildGreenRoomRosterSnapshot('cmp-roster-test', [
      assignment('reg-1', 'A', 0, 'cmp-roster-test', {
        participantId: 'part-reassigned',
        participantName: 'Different Student',
        teamId: 'team-1',
        teamCode: 'SHA',
        chestNumber: '101'
      })
    ]);

    expect(identityChanged.version).not.toBe(original.version);
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
