import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportService, PublishedWinnerRow } from '@/services/exportService';
import { CompetitionResult } from '@/types/fest';
import ExcelJS from 'exceljs';

describe('ExportService - ExcelJS Official Winners Export', () => {
  const sampleResults: CompetitionResult[] = [
    {
      id: 'res-1',
      competitionId: 'comp-1',
      competitionCode: 'ENG-ELOC',
      competitionName: 'English Elocution',
      categoryName: 'Senior Boys',
      type: 'SOLO',
      stageName: 'Main Auditorium',
      marksStatus: 'COMPLETE',
      posterReleased: false,
      ranks: [
        {
          rank: 1,
          registrationId: 'reg-1',
          candidateName: 'Zayd Ahmed',
          bib: '101',
          teamId: 't-1',
          teamName: 'Al-Hasan',
          teamCode: 'ALH',
          teamColor: '#2563EB',
          score: 95,
          grade: 'A',
          officialPoints: 10,
          totalEarnedPoints: 10
        },
        {
          rank: 2,
          registrationId: 'reg-2',
          candidateName: 'Bilal Khan',
          bib: '102',
          teamId: 't-2',
          teamName: 'Al-Husayn',
          teamCode: 'ALU',
          teamColor: '#10B981',
          score: 88,
          grade: 'B',
          officialPoints: 5,
          totalEarnedPoints: 5
        },
        {
          rank: 3,
          registrationId: 'reg-3',
          candidateName: 'Tariq Mansoor',
          bib: '103',
          teamId: 't-3',
          teamName: 'Al-Farooq',
          teamCode: 'ALF',
          teamColor: '#F59E0B',
          score: 82,
          grade: 'C',
          officialPoints: 3,
          totalEarnedPoints: 3
        }
      ],
      resultStatus: 'PUBLISHED',
      publishedDate: '2026-11-10T10:00:00Z'
    },
    {
      id: 'res-2',
      competitionId: 'comp-2',
      competitionCode: 'ARB-CALLI',
      competitionName: 'Arabic Calligraphy',
      categoryName: 'General',
      type: 'SOLO',
      stageName: 'Art Gallery',
      marksStatus: 'COMPLETE',
      posterReleased: false,
      ranks: [
        {
          rank: 1,
          registrationId: 'reg-4',
          candidateName: 'Omar Farooq',
          bib: '201',
          teamId: 't-1',
          teamName: 'Al-Hasan',
          teamCode: 'ALH',
          teamColor: '#2563EB',
          score: 92,
          grade: 'A',
          officialPoints: 10,
          totalEarnedPoints: 10
        }
      ],
      resultStatus: 'DRAFT' // Should be excluded!
    },
    {
      id: 'res-3',
      competitionId: 'comp-3',
      competitionCode: 'QIR-RECIT',
      competitionName: 'Qiraath Recitation',
      categoryName: 'Junior Boys',
      type: 'SOLO',
      stageName: 'Prayer Hall',
      marksStatus: 'PARTIAL',
      posterReleased: false,
      ranks: [],
      resultStatus: 'READY_FOR_REVIEW' // Should be excluded!
    }
  ];

  describe('1. Published-results-only filtering', () => {
    it('strictly filters only results with resultStatus === "PUBLISHED"', () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);

      expect(rows).toHaveLength(1);
      expect(rows[0].competitionCode).toBe('ENG-ELOC');
      expect(rows[0].competitionName).toBe('English Elocution');
    });

    it('returns an empty array when no results are PUBLISHED', () => {
      const unpublished = sampleResults.filter(r => r.resultStatus !== 'PUBLISHED');
      const rows = ExportService.getOfficialPublishedWinners(unpublished);

      expect(rows).toHaveLength(0);
    });

    it('correctly maps ranks, grades, bib numbers, team names with code brackets, and points', () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      const row = rows[0];

      expect(row.rank1Name).toBe('Zayd Ahmed');
      expect(row.rank1Bib).toBe('101');
      expect(row.rank1Team).toBe('Al-Hasan [ALH]');
      expect(row.rank1Grade).toBe('A');
      expect(row.rank1Points).toBe(10);

      expect(row.rank2Name).toBe('Bilal Khan');
      expect(row.rank2Bib).toBe('102');
      expect(row.rank2Team).toBe('Al-Husayn [ALU]');
      expect(row.rank2Grade).toBe('B');
      expect(row.rank2Points).toBe(5);

      expect(row.rank3Name).toBe('Tariq Mansoor');
      expect(row.rank3Bib).toBe('103');
      expect(row.rank3Team).toBe('Al-Farooq [ALF]');
      expect(row.rank3Grade).toBe('C');
      expect(row.rank3Points).toBe(3);

      expect(row.eventTotalPoints).toBe(18);
    });

    it('falls back to totalEarnedPoints when officialPoints is null/undefined', () => {
      const customResults: CompetitionResult[] = [
        {
          ...sampleResults[0],
          ranks: [
            {
              rank: 1,
              registrationId: 'reg-1',
              candidateName: 'Zayd Ahmed',
              bib: '101',
              teamId: 't-1',
              teamName: 'Al-Hasan',
              teamCode: 'ALH',
              teamColor: '#2563EB',
              score: 95,
              grade: 'A',
              officialPoints: undefined as unknown as number,
              totalEarnedPoints: 7
            }
          ]
        }
      ];

      const rows = ExportService.getOfficialPublishedWinners(customResults);
      expect(rows[0].rank1Points).toBe(7);
      expect(rows[0].eventTotalPoints).toBe(7);
    });

    it('handles missing 2nd and 3rd ranks with default placeholders', () => {
      const singleWinnerResult: CompetitionResult[] = [
        {
          ...sampleResults[0],
          ranks: [sampleResults[0].ranks[0]]
        }
      ];

      const rows = ExportService.getOfficialPublishedWinners(singleWinnerResult);
      const row = rows[0];

      expect(row.rank1Name).toBe('Zayd Ahmed');
      expect(row.rank2Name).toBe('-');
      expect(row.rank2Bib).toBe('-');
      expect(row.rank2Team).toBe('-');
      expect(row.rank2Grade).toBe('-');
      expect(row.rank2Points).toBe(0);

      expect(row.rank3Name).toBe('-');
      expect(row.rank3Bib).toBe('-');
      expect(row.rank3Team).toBe('-');
      expect(row.rank3Grade).toBe('-');
      expect(row.rank3Points).toBe(0);

      expect(row.eventTotalPoints).toBe(10);
    });
  });

  describe('2. ExcelJS Workbook structure and column configurations', () => {
    const expectedHeaders = [
      'Competition Code',
      'Competition Name',
      'Category',
      'Event Type',
      '1st Place Winner',
      '1st Bib',
      '1st Team',
      '1st Grade',
      '1st Points',
      '2nd Place Winner',
      '2nd Bib',
      '2nd Team',
      '2nd Grade',
      '2nd Points',
      '3rd Place Winner',
      '3rd Bib',
      '3rd Team',
      '3rd Grade',
      '3rd Points',
      'Event Total Points'
    ];

    const expectedWidths = [
      14, // Code
      28, // Name
      14, // Category
      10, // Event Type
      24, // 1st Place Winner
      10, // 1st Bib
      18, // 1st Team
      10, // 1st Grade
      10, // 1st Points
      24, // 2nd Place Winner
      10, // 2nd Bib
      18, // 2nd Team
      10, // 2nd Grade
      10, // 2nd Points
      24, // 3rd Place Winner
      10, // 3rd Bib
      18, // 3rd Team
      10, // 3rd Grade
      10, // 3rd Points
      14  // Event Total Points
    ];

    it('creates a worksheet named "Official Winners"', () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      const workbook = ExportService.generateWinnersWorkbook(rows);

      const worksheet = workbook.getWorksheet('Official Winners');
      expect(worksheet).toBeDefined();
      expect(worksheet!.name).toBe('Official Winners');
    });

    it('preserves exactly 20 columns and their exact headers and order', () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      const workbook = ExportService.generateWinnersWorkbook(rows);
      const worksheet = workbook.getWorksheet('Official Winners');

      expect(worksheet).toBeDefined();
      expect(worksheet!.columns).toBeDefined();
      expect(worksheet!.columns).toHaveLength(20);

      const actualHeaders = worksheet!.columns!.map(col => col.header);
      expect(actualHeaders).toEqual(expectedHeaders);
    });

    it('preserves all 20 column widths exactly matching the specification', () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      const workbook = ExportService.generateWinnersWorkbook(rows);
      const worksheet = workbook.getWorksheet('Official Winners');

      expect(worksheet).toBeDefined();
      const actualWidths = worksheet!.columns!.map(col => col.width);
      expect(actualWidths).toEqual(expectedWidths);
    });

    it('populates row data correctly matching PublishedWinnerRow properties', () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      const workbook = ExportService.generateWinnersWorkbook(rows);
      const worksheet = workbook.getWorksheet('Official Winners');

      expect(worksheet).toBeDefined();
      // Row 1 is header, Row 2 is first data row
      const dataRow = worksheet!.getRow(2);
      expect(dataRow.getCell(1).value).toBe('ENG-ELOC');
      expect(dataRow.getCell(2).value).toBe('English Elocution');
      expect(dataRow.getCell(3).value).toBe('Senior Boys');
      expect(dataRow.getCell(4).value).toBe('SOLO');
      expect(dataRow.getCell(5).value).toBe('Zayd Ahmed');
      expect(dataRow.getCell(6).value).toBe('101');
      expect(dataRow.getCell(7).value).toBe('Al-Hasan [ALH]');
      expect(dataRow.getCell(8).value).toBe('A');
      expect(dataRow.getCell(9).value).toBe(10);
      expect(dataRow.getCell(10).value).toBe('Bilal Khan');
      expect(dataRow.getCell(11).value).toBe('102');
      expect(dataRow.getCell(12).value).toBe('Al-Husayn [ALU]');
      expect(dataRow.getCell(13).value).toBe('B');
      expect(dataRow.getCell(14).value).toBe(5);
      expect(dataRow.getCell(15).value).toBe('Tariq Mansoor');
      expect(dataRow.getCell(16).value).toBe('103');
      expect(dataRow.getCell(17).value).toBe('Al-Farooq [ALF]');
      expect(dataRow.getCell(18).value).toBe('C');
      expect(dataRow.getCell(19).value).toBe(3);
      expect(dataRow.getCell(20).value).toBe(18);
    });
  });

  describe('3. OpenXML XLSX Binary Generation & Readback Round-trip', () => {
    it('generates a valid .xlsx buffer that can be loaded back and verified with ExcelJS', async () => {
      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      const workbook = ExportService.generateWinnersWorkbook(rows);

      const buffer = await workbook.xlsx.writeBuffer();
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(0);

      // Verify that another ExcelJS Workbook instance can parse the generated buffer
      const readBackWorkbook = new ExcelJS.Workbook();
      await readBackWorkbook.xlsx.load(buffer);

      const readBackSheet = readBackWorkbook.getWorksheet('Official Winners');
      expect(readBackSheet).toBeDefined();
      expect(readBackSheet!.name).toBe('Official Winners');
      expect(readBackSheet!.rowCount).toBe(2); // 1 header + 1 data row

      // Verify row 1 header values
      const headerRow = readBackSheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe('Competition Code');
      expect(headerRow.getCell(2).value).toBe('Competition Name');
      expect(headerRow.getCell(20).value).toBe('Event Total Points');

      // Verify row 2 data values
      const dataRow = readBackSheet!.getRow(2);
      expect(dataRow.getCell(1).value).toBe('ENG-ELOC');
      expect(dataRow.getCell(5).value).toBe('Zayd Ahmed');
      expect(dataRow.getCell(9).value).toBe(10);
      expect(dataRow.getCell(20).value).toBe(18);

      // Verify column widths on read back
      expect(readBackSheet!.getColumn(1).width).toBe(14);
      expect(readBackSheet!.getColumn(2).width).toBe(28);
      expect(readBackSheet!.getColumn(20).width).toBe(14);
    });

    it('handles multiple data rows cleanly without corruption', async () => {
      const multiRows: PublishedWinnerRow[] = [
        {
          competitionCode: 'EV-01',
          competitionName: 'Event One',
          categoryName: 'Cat A',
          type: 'SOLO',
          rank1Name: 'Winner 1',
          rank1Bib: 'B1',
          rank1Team: 'Team A [TA]',
          rank1Grade: 'A',
          rank1Points: 10,
          rank2Name: 'Winner 2',
          rank2Bib: 'B2',
          rank2Team: 'Team B [TB]',
          rank2Grade: 'B',
          rank2Points: 5,
          rank3Name: 'Winner 3',
          rank3Bib: 'B3',
          rank3Team: 'Team C [TC]',
          rank3Grade: 'C',
          rank3Points: 3,
          eventTotalPoints: 18
        },
        {
          competitionCode: 'EV-02',
          competitionName: 'Event Two',
          categoryName: 'Cat B',
          type: 'GROUP',
          rank1Name: 'Winner 4',
          rank1Bib: 'B4',
          rank1Team: 'Team D [TD]',
          rank1Grade: 'A',
          rank1Points: 15,
          rank2Name: '-',
          rank2Bib: '-',
          rank2Team: '-',
          rank2Grade: '-',
          rank2Points: 0,
          rank3Name: '-',
          rank3Bib: '-',
          rank3Team: '-',
          rank3Grade: '-',
          rank3Points: 0,
          eventTotalPoints: 15
        }
      ];

      const workbook = ExportService.generateWinnersWorkbook(multiRows);
      const buffer = await workbook.xlsx.writeBuffer();

      const readBack = new ExcelJS.Workbook();
      await readBack.xlsx.load(buffer);
      const sheet = readBack.getWorksheet('Official Winners');

      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBe(3); // 1 header + 2 data rows
      expect(sheet!.getRow(3).getCell(1).value).toBe('EV-02');
      expect(sheet!.getRow(3).getCell(4).value).toBe('GROUP');
      expect(sheet!.getRow(3).getCell(20).value).toBe(15);
    });
  });

  describe('4. Browser Download Execution', () => {
    let originalWindow: typeof globalThis.window;
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalWindow = globalThis.window;
      originalDocument = globalThis.document;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      vi.restoreAllMocks();
    });

    it('gracefully exits without throwing when window is undefined (SSR safety)', async () => {
      // Ensure window is undefined
      // @ts-expect-error simulating server environment
      delete globalThis.window;

      const rows = ExportService.getOfficialPublishedWinners(sampleResults);
      await expect(
        ExportService.downloadWinnersXLSX(rows, 'test_export.xlsx')
      ).resolves.not.toThrow();
    });

    it('creates Blob, sets filename with .xlsx extension, triggers click and revokes URL in browser', async () => {
      const clickMock = vi.fn();
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();

      interface MockAnchor {
        href: string;
        download: string;
        click: () => void;
      }

      const fakeLink: MockAnchor = {
        href: '',
        download: '',
        click: clickMock
      };

      const mockDocument = {
        createElement: vi.fn().mockReturnValue(fakeLink as unknown as HTMLElement),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock
        }
      };

      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake-uuid');
      const mockRevokeObjectURL = vi.fn();

      globalThis.window = {} as unknown as Window & typeof globalThis;
      globalThis.document = mockDocument as unknown as Document;
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      const rows = ExportService.getOfficialPublishedWinners(sampleResults);

      // Test with filename without extension
      await ExportService.downloadWinnersXLSX(rows, 'Inspirath_Winners');

      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(fakeLink.download).toBe('Inspirath_Winners.xlsx');
      expect(fakeLink.href).toBe('blob:http://localhost/fake-uuid');
      expect(appendChildMock).toHaveBeenCalledWith(fakeLink);
      expect(clickMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalledWith(fakeLink);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-uuid');
    });

    it('does not duplicate .xlsx extension if already present in filename', async () => {
      const clickMock = vi.fn();
      interface MockAnchor {
        href: string;
        download: string;
        click: () => void;
      }
      const fakeLink: MockAnchor = { href: '', download: '', click: clickMock };
      const mockDocument = {
        createElement: vi.fn().mockReturnValue(fakeLink as unknown as HTMLElement),
        body: { appendChild: vi.fn(), removeChild: vi.fn() }
      };

      globalThis.window = {} as unknown as Window & typeof globalThis;
      globalThis.document = mockDocument as unknown as Document;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake-uuid-2');
      globalThis.URL.revokeObjectURL = vi.fn();

      const rows = ExportService.getOfficialPublishedWinners(sampleResults);

      await ExportService.downloadWinnersXLSX(rows, 'Inspirath_Winners.xlsx');

      expect(fakeLink.download).toBe('Inspirath_Winners.xlsx');
    });
  });
});
