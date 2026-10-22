import { describe, it, expect } from 'vitest';
import {
  commitResultToLedger,
  reverseResultInLedger,
  recalculateTeamChampionship,
  PointsLedgerEntry,
  CompetitionRankInput
} from '../ledger';

describe('Result Publication Logic & Championship Points Ledger', () => {
  const baseTeams = [
    { id: 'team-1', code: 'ABH', name: 'Al-Bayan House' },
    { id: 'team-2', code: 'BSH', name: 'Badr Squad' },
    { id: 'team-3', code: 'KAH', name: 'Khalid Al-Walid' },
    { id: 'team-4', code: 'FSH', name: 'Fathul Mubeen' }
  ];

  it('Requirement: Judge submitting marks does NOT update championship points until Admin publishes', () => {
    // Empty ledger represents state before publication
    const emptyLedger: PointsLedgerEntry[] = [];
    const totals = recalculateTeamChampionship(baseTeams, emptyLedger);

    totals.forEach(team => {
      expect(team.totalPoints).toBe(0);
      expect(team.firstCount).toBe(0);
    });
  });

  it('Requirement: Admin publishing commits official points to ledger and updates team points', () => {
    const competition = {
      id: 'comp-1',
      code: 'CMP-01',
      name: 'Quran Recitation',
      type: 'SOLO' as const
    };

    const ranks: CompetitionRankInput[] = [
      {
        registrationId: 'reg-1',
        bib: '1042',
        candidateName: 'Ahmad Bilal',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        score: 95,
        rank: 1,
        grade: 'A+' // 1st with A+ in SOLO = 11 pts
      },
      {
        registrationId: 'reg-2',
        bib: '1088',
        candidateName: 'Zainab Qasim',
        teamId: 'team-2',
        teamCode: 'BSH',
        teamName: 'Badr Squad',
        score: 88,
        rank: 2,
        grade: 'A' // 2nd with A in SOLO = 8 pts
      },
      {
        registrationId: 'reg-3',
        bib: '1105',
        candidateName: 'Ibrahim Ali',
        teamId: 'team-3',
        teamCode: 'KAH',
        teamName: 'Khalid Al-Walid',
        score: 72,
        rank: 3,
        grade: 'A' // 3rd with A in SOLO = 6 pts
      },
      {
        registrationId: 'reg-4',
        bib: '1120',
        candidateName: 'Tariq Niyas',
        teamId: 'team-4',
        teamCode: 'FSH',
        teamName: 'Fathul Mubeen',
        score: 65,
        rank: null,
        grade: 'B' // No prize with B in SOLO = 3 pts
      }
    ];

    const ledger = commitResultToLedger('res-1', competition, ranks, []);
    expect(ledger.length).toBe(4);

    const totals = recalculateTeamChampionship(baseTeams, ledger);

    const abh = totals.find(t => t.teamCode === 'ABH')!;
    const bsh = totals.find(t => t.teamCode === 'BSH')!;
    const kah = totals.find(t => t.teamCode === 'KAH')!;
    const fsh = totals.find(t => t.teamCode === 'FSH')!;

    expect(abh.totalPoints).toBe(11); // 1st + A+
    expect(abh.soloPoints).toBe(11);
    expect(abh.firstCount).toBe(1);

    expect(bsh.totalPoints).toBe(8); // 2nd + A
    expect(bsh.secondCount).toBe(1);

    expect(kah.totalPoints).toBe(6); // 3rd + A
    expect(kah.thirdCount).toBe(1);

    expect(fsh.totalPoints).toBe(3); // No prize + B = 3 pts

    expect(totals[0].teamCode).toBe('ABH');
    expect(totals[0].rank).toBe(1);
  });

  it('Requirement: Duplicate publication prevention (Idempotency)', () => {
    const competition = {
      id: 'comp-1',
      code: 'CMP-01',
      name: 'Quran Recitation',
      type: 'SOLO' as const
    };

    const ranks: CompetitionRankInput[] = [
      {
        registrationId: 'reg-1',
        bib: '1042',
        candidateName: 'Ahmad Bilal',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        score: 95,
        rank: 1,
        grade: 'A+'
      }
    ];

    // First commit
    const ledgerStep1 = commitResultToLedger('res-1', competition, ranks, []);
    expect(ledgerStep1.length).toBe(1);

    // Second commit of the same result (e.g. admin clicks twice or network retry)
    const ledgerStep2 = commitResultToLedger('res-1', competition, ranks, ledgerStep1);
    expect(ledgerStep2.length).toBe(1);

    const totals = recalculateTeamChampionship(baseTeams, ledgerStep2);
    const abh = totals.find(t => t.teamCode === 'ABH')!;
    expect(abh.totalPoints).toBe(11); // NOT 22
  });

  it('Requirement: Result reversal/unpublishing safely recalculates points', () => {
    const competition = {
      id: 'comp-1',
      code: 'CMP-01',
      name: 'Quran Recitation',
      type: 'SOLO' as const
    };

    const ranks: CompetitionRankInput[] = [
      {
        registrationId: 'reg-1',
        bib: '1042',
        candidateName: 'Ahmad Bilal',
        teamId: 'team-1',
        teamCode: 'ABH',
        teamName: 'Al-Bayan House',
        score: 95,
        rank: 1,
        grade: 'A+'
      }
    ];

    const activeLedger = commitResultToLedger('res-1', competition, ranks, []);
    expect(recalculateTeamChampionship(baseTeams, activeLedger)[0].totalPoints).toBe(11);

    // Unpublish / mark for revision
    const reversedLedger = reverseResultInLedger('res-1', activeLedger, 'Administrative re-tabulation');
    const totalsAfterReversal = recalculateTeamChampionship(baseTeams, reversedLedger);
    const abh = totalsAfterReversal.find(t => t.teamCode === 'ABH')!;
    expect(abh.totalPoints).toBe(0);
    expect(abh.firstCount).toBe(0);
  });
});
