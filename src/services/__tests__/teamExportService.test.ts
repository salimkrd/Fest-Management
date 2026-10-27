import { describe, expect, it } from 'vitest';
import { TeamExportService, type TeamResultExportRow } from '../teamExportService';

const row: TeamResultExportRow = {
  competitionCode: 'CMP-01',
  competitionName: 'Qur’an Recitation',
  categoryName: 'Senior',
  type: 'SOLO',
  stageName: 'Main Auditorium',
  candidateName: 'Ameen "A.J." Farhan',
  bib: '1042',
  grade: 'A+',
  rank: 1,
  points: 11,
  publishedDate: '2026-10-27'
};

describe('TeamExportService', () => {
  it('creates a CSV with team result details and correctly escaped quoted values', () => {
    const csv = TeamExportService.generateCSV([row]);
    expect(csv).toContain('Competition Code');
    expect(csv).toContain('"CMP-01"');
    expect(csv).toContain('"Ameen ""A.J."" Farhan"');
    expect(csv).toContain('"1st Place"');
    expect(csv).toContain('"A+"');
    expect(csv).toContain('"11"');
    expect(csv).not.toContain('Score');
    expect(csv).not.toContain('"94"');
  });

  it('keeps the grade-only/no-prize placement label in CSV output', () => {
    const noPrizeRow: TeamResultExportRow = { ...row, rank: null, points: 5 };
    const csv = TeamExportService.generateCSV([noPrizeRow]);
    expect(csv).toContain('"Grade-only / No Prize"');
    expect(csv).toContain('"5"');
  });
});
