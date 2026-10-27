import { describe, it, expect } from 'vitest';
import { ExportService } from '../exportService';
import { CompetitionResult } from '@/types/fest';

describe('ExportService — Official Published Winners Verification', () => {
  const sampleResults: CompetitionResult[] = [
    {
      id: 'res-pub-1',
      competitionId: 'cmp-1',
      competitionCode: 'QRN-SR',
      competitionName: "Qur'an Recitation",
      categoryName: 'Senior',
      type: 'SOLO',
      stageName: 'Stage 1',
      marksStatus: 'COMPLETE',
      resultStatus: 'PUBLISHED',
      posterReleased: true,
      ranks: [
        { rank: 1, bib: '101', candidateName: 'Ameen Farhan', registrationId: 'reg-1', teamId: 'team-1', teamName: 'Al-Shamama', teamCode: 'SHA', teamColor: '#2563EB', score: 95, grade: 'A+', totalEarnedPoints: 11, officialPoints: 11 },
        { rank: 2, bib: '102', candidateName: 'Muhammad Sinan', registrationId: 'reg-2', teamId: 'team-2', teamName: 'An-Nawa', teamCode: 'NAW', teamColor: '#059669', score: 88, grade: 'A', totalEarnedPoints: 8, officialPoints: 8 },
        { rank: 3, bib: '103', candidateName: 'Bilal Shahid', registrationId: 'reg-3', teamId: 'team-3', teamName: 'Al-Ishraq', teamCode: 'ISH', teamColor: '#D97706', score: 74, grade: 'A', totalEarnedPoints: 6, officialPoints: 6 }
      ]
    },
    {
      id: 'res-draft-2',
      competitionId: 'cmp-2',
      competitionCode: 'ELO-JR',
      competitionName: 'Malayalam Elocution',
      categoryName: 'Junior',
      type: 'SOLO',
      stageName: 'Stage 2',
      marksStatus: 'COMPLETE',
      resultStatus: 'READY_FOR_REVIEW', // UNPUBLISHED
      posterReleased: false,
      ranks: [
        { rank: 1, bib: '201', candidateName: 'Zayan Ahmed', registrationId: 'reg-4', teamId: 'team-1', teamName: 'Al-Shamama', teamCode: 'SHA', teamColor: '#2563EB', score: 91, grade: 'A+', totalEarnedPoints: 11, officialPoints: 11 }
      ]
    }
  ];

  it('Requirement: Excludes unpublished and draft results strictly', () => {
    const publishedRows = ExportService.getOfficialPublishedWinners(sampleResults);
    expect(publishedRows.length).toBe(1);
    expect(publishedRows[0].competitionCode).toBe('QRN-SR');
    expect(publishedRows.find(r => r.competitionCode === 'ELO-JR')).toBeUndefined();
  });

  it('Requirement: Includes correct 1st, 2nd, and 3rd winners, teams, grades, and official points', () => {
    const publishedRows = ExportService.getOfficialPublishedWinners(sampleResults);
    const row = publishedRows[0];

    // 1st Place
    expect(row.rank1Name).toBe('Ameen Farhan');
    expect(row.rank1Bib).toBe('101');
    expect(row.rank1Team).toBe('Al-Shamama [SHA]');
    expect(row.rank1Grade).toBe('A+');
    expect(row.rank1Points).toBe(11);

    // 2nd Place
    expect(row.rank2Name).toBe('Muhammad Sinan');
    expect(row.rank2Bib).toBe('102');
    expect(row.rank2Team).toBe('An-Nawa [NAW]');
    expect(row.rank2Grade).toBe('A');
    expect(row.rank2Points).toBe(8);

    // 3rd Place
    expect(row.rank3Name).toBe('Bilal Shahid');
    expect(row.rank3Bib).toBe('103');
    expect(row.rank3Team).toBe('Al-Ishraq [ISH]');
    expect(row.rank3Grade).toBe('A');
    expect(row.rank3Points).toBe(6);

    // Event Total Points
    expect(row.eventTotalPoints).toBe(25);
  });

  it('exports grades and official points without raw scores', () => {
    const rows = ExportService.getOfficialPublishedWinners(sampleResults);
    const csv = ExportService.generateWinnersCSV(rows);
    expect(csv).toContain('1st Grade');
    expect(csv).toContain('1st Points');
    expect(csv).toContain('"A+"');
    expect(csv).toContain(',11,');
    expect(csv).not.toContain('95');
    expect(csv).not.toContain('88');
    expect(csv).not.toContain('74');
    expect(csv).not.toContain('Score');
  });
});
