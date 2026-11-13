/**
 * Official Export Service
 * Strictly filters for PUBLISHED competition results when exporting official winners.
 * Generates genuine downloadable CSV, XLSX (OpenXML via ExcelJS), and PDF files.
 */

import { CompetitionResult } from '@/types/fest';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

export interface PublishedWinnerRow {
  competitionCode: string;
  competitionName: string;
  categoryName: string;
  type: string;
  rank1Name: string;
  rank1Bib: string;
  rank1Team: string;
  rank1Grade: string;
  rank1Points: number;
  rank2Name: string;
  rank2Bib: string;
  rank2Team: string;
  rank2Grade: string;
  rank2Points: number;
  rank3Name: string;
  rank3Bib: string;
  rank3Team: string;
  rank3Grade: string;
  rank3Points: number;
  eventTotalPoints: number;
}

export class ExportService {
  /**
   * Transforms competition results into official published winners export rows.
   * STRICT SECURITY: Excludes any result whose status is NOT 'PUBLISHED'.
   */
  static getOfficialPublishedWinners(results: CompetitionResult[]): PublishedWinnerRow[] {
    const publishedOnly = results.filter(r => r.resultStatus === 'PUBLISHED');

    return publishedOnly.map(res => {
      const r1 = res.ranks.find(r => r.rank === 1);
      const r2 = res.ranks.find(r => r.rank === 2);
      const r3 = res.ranks.find(r => r.rank === 3);

      const r1Pts = r1 ? (r1.officialPoints ?? r1.totalEarnedPoints ?? 0) : 0;
      const r2Pts = r2 ? (r2.officialPoints ?? r2.totalEarnedPoints ?? 0) : 0;
      const r3Pts = r3 ? (r3.officialPoints ?? r3.totalEarnedPoints ?? 0) : 0;

      return {
        competitionCode: res.competitionCode,
        competitionName: res.competitionName,
        categoryName: res.categoryName || 'General',
        type: res.type || 'SOLO',
        rank1Name: r1 ? r1.candidateName : '-',
        rank1Bib: r1 ? (r1.bib || '-') : '-',
        rank1Team: r1 ? `${r1.teamName} [${r1.teamCode || ''}]` : '-',
        rank1Grade: r1 ? (r1.grade || '-') : '-',
        rank1Points: r1Pts,
        rank2Name: r2 ? r2.candidateName : '-',
        rank2Bib: r2 ? (r2.bib || '-') : '-',
        rank2Team: r2 ? `${r2.teamName} [${r2.teamCode || ''}]` : '-',
        rank2Grade: r2 ? (r2.grade || '-') : '-',
        rank2Points: r2Pts,
        rank3Name: r3 ? r3.candidateName : '-',
        rank3Bib: r3 ? (r3.bib || '-') : '-',
        rank3Team: r3 ? `${r3.teamName} [${r3.teamCode || ''}]` : '-',
        rank3Grade: r3 ? (r3.grade || '-') : '-',
        rank3Points: r3Pts,
        eventTotalPoints: r1Pts + r2Pts + r3Pts
      };
    });
  }

  /**
   * Generates standard RFC 4180 CSV string of official published winners.
   */
  static generateWinnersCSV(rows: PublishedWinnerRow[]): string {
    const escapeField = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      if (typeof val === 'number') return String(val);
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const header = [
      'Competition Code', 'Competition Name', 'Category', 'Type',
      '1st Winner', '1st Bib', '1st Team', '1st Grade', '1st Points',
      '2nd Winner', '2nd Bib', '2nd Team', '2nd Grade', '2nd Points',
      '3rd Winner', '3rd Bib', '3rd Team', '3rd Grade', '3rd Points',
      'Event Total Points'
    ].join(',');

    const lines = rows.map(r => [
      escapeField(r.competitionCode),
      escapeField(r.competitionName),
      escapeField(r.categoryName),
      escapeField(r.type),
      escapeField(r.rank1Name),
      escapeField(r.rank1Bib),
      escapeField(r.rank1Team),
      escapeField(r.rank1Grade),
      r.rank1Points,
      escapeField(r.rank2Name),
      escapeField(r.rank2Bib),
      escapeField(r.rank2Team),
      escapeField(r.rank2Grade),
      r.rank2Points,
      escapeField(r.rank3Name),
      escapeField(r.rank3Bib),
      escapeField(r.rank3Team),
      escapeField(r.rank3Grade),
      r.rank3Points,
      r.eventTotalPoints
    ].join(','));

    return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
  }

  /**
   * Generates and triggers download of a genuine RFC 4180 CSV file.
   */
  static downloadWinnersCSV(rows: PublishedWinnerRow[], filename: string): void {
    if (typeof window === 'undefined') return;

    const csvContent = this.generateWinnersCSV(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Builds an ExcelJS Workbook object containing official published winners.
   * Configures 20 standard columns, headers, widths, and the 'Official Winners' worksheet.
   */
  static generateWinnersWorkbook(rows: PublishedWinnerRow[]): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Official Winners');

    worksheet.columns = [
      { header: 'Competition Code', key: 'competitionCode', width: 14 },
      { header: 'Competition Name', key: 'competitionName', width: 28 },
      { header: 'Category', key: 'categoryName', width: 14 },
      { header: 'Event Type', key: 'type', width: 10 },
      { header: '1st Place Winner', key: 'rank1Name', width: 24 },
      { header: '1st Bib', key: 'rank1Bib', width: 10 },
      { header: '1st Team', key: 'rank1Team', width: 18 },
      { header: '1st Grade', key: 'rank1Grade', width: 10 },
      { header: '1st Points', key: 'rank1Points', width: 10 },
      { header: '2nd Place Winner', key: 'rank2Name', width: 24 },
      { header: '2nd Bib', key: 'rank2Bib', width: 10 },
      { header: '2nd Team', key: 'rank2Team', width: 18 },
      { header: '2nd Grade', key: 'rank2Grade', width: 10 },
      { header: '2nd Points', key: 'rank2Points', width: 10 },
      { header: '3rd Place Winner', key: 'rank3Name', width: 24 },
      { header: '3rd Bib', key: 'rank3Bib', width: 10 },
      { header: '3rd Team', key: 'rank3Team', width: 18 },
      { header: '3rd Grade', key: 'rank3Grade', width: 10 },
      { header: '3rd Points', key: 'rank3Points', width: 10 },
      { header: 'Event Total Points', key: 'eventTotalPoints', width: 14 }
    ];

    rows.forEach(r => {
      worksheet.addRow({
        competitionCode: r.competitionCode,
        competitionName: r.competitionName,
        categoryName: r.categoryName,
        type: r.type,
        rank1Name: r.rank1Name,
        rank1Bib: r.rank1Bib,
        rank1Team: r.rank1Team,
        rank1Grade: r.rank1Grade,
        rank1Points: r.rank1Points,
        rank2Name: r.rank2Name,
        rank2Bib: r.rank2Bib,
        rank2Team: r.rank2Team,
        rank2Grade: r.rank2Grade,
        rank2Points: r.rank2Points,
        rank3Name: r.rank3Name,
        rank3Bib: r.rank3Bib,
        rank3Team: r.rank3Team,
        rank3Grade: r.rank3Grade,
        rank3Points: r.rank3Points,
        eventTotalPoints: r.eventTotalPoints
      });
    });

    return workbook;
  }

  /**
   * Generates and triggers download of a genuine OpenXML XLSX spreadsheet (.xlsx) using ExcelJS.
   */
  static async downloadWinnersXLSX(rows: PublishedWinnerRow[], filename: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const workbook = this.generateWinnersWorkbook(rows);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates and triggers download of a genuine downloadable PDF document (.pdf).
   */
  static downloadWinnersPDF(
    rows: PublishedWinnerRow[],
    festivalName: string,
    institutionName: string,
    filename: string
  ): void {
    if (typeof window === 'undefined') return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const tableWidth = pageWidth - margin * 2;
    const generatedDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const columnWidths = [44, 138, 78, 154, 154, 154, 64];
    const columnLabels = ['CODE', 'COMPETITION', 'CATEGORY / TYPE', '1ST PRIZE', '2ND PRIZE', '3RD PRIZE', 'TOTAL'];

    const fitLines = (value: string, width: number): string[] => {
      const lines = doc.splitTextToSize(value || '-', width) as string[];
      return lines.length ? lines : ['-'];
    };

    const buildWinner = (name: string, bib: string, team: string, grade: string, points: number) => {
      const empty = !name || name === '-';
      return {
        nameLines: empty ? ['-'] : fitLines(name, 142).slice(0, 2),
        teamLines: empty ? [] : fitLines(team || '-', 142).slice(0, 2),
        metaLines: empty ? [] : fitLines('Bib ' + (bib || '-') + ' | Grade ' + (grade || '-') + ' | +' + points + ' pts', 142).slice(0, 2)
      };
    };

    const winnerLineCount = (winner: ReturnType<typeof buildWinner>) =>
      winner.nameLines.length + winner.teamLines.length + winner.metaLines.length;

    const drawPageHeader = (): number => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 60, 'F');
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 7, 60, 'F');

      const title = (festivalName || 'FESTIVAL').toUpperCase();
      doc.setFont('helvetica', 'bold');
      let titleSize = 16;
      doc.setFontSize(titleSize);
      while (doc.getTextWidth(title) > tableWidth - 180 && titleSize > 9) {
        titleSize -= 0.5;
        doc.setFontSize(titleSize);
      }
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin, 25);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const institutionLines = fitLines(institutionName || 'Official Results', tableWidth - 175).slice(0, 2);
      doc.text(institutionLines, margin, 43, { lineHeightFactor: 1.05 });
      doc.setFontSize(8);
      doc.text('GENERATED ' + generatedDate, pageWidth - margin, 43, { align: 'right' });

      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('OFFICIAL PUBLISHED WINNERS', margin, 82);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(82, 96, 112);
      doc.text(rows.length + ' published competitions | Verified results only', margin, 96);

      let x = margin;
      const headerY = 108;
      const headerHeight = 24;
      doc.setLineWidth(0.5);
      columnLabels.forEach((label, index) => {
        const width = columnWidths[index];
        doc.setFillColor(226, 232, 240);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, headerY, width, headerHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        const align = index === 0 || index === 2 || index === 6 ? 'center' : 'left';
        doc.text(label, align === 'center' ? x + width / 2 : x + 5, headerY + 15, { align });
        x += width;
      });
      return headerY + headerHeight;
    };

    const drawWinnerCell = (
      x: number,
      y: number,
      width: number,
      height: number,
      winner: ReturnType<typeof buildWinner>
    ) => {
      if (winner.nameLines.length === 1 && winner.nameLines[0] === '-' && winner.teamLines.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('-', x + width / 2, y + height / 2 + 3, { align: 'center' });
        return;
      }

      let textY = y + 9;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(17, 24, 39);
      doc.text(winner.nameLines, x + 5, textY, { lineHeightFactor: 1.05 });
      textY += winner.nameLines.length * 8;

      if (winner.teamLines.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text(winner.teamLines, x + 5, textY, { lineHeightFactor: 1.05 });
        textY += winner.teamLines.length * 7;
      }

      if (winner.metaLines.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.1);
        doc.setTextColor(37, 99, 235);
        doc.text(winner.metaLines, x + 5, textY, { lineHeightFactor: 1.05 });
      }
    };

    let y = drawPageHeader();
    rows.forEach((row, rowIndex) => {
      const r1 = buildWinner(row.rank1Name, row.rank1Bib, row.rank1Team, row.rank1Grade, row.rank1Points);
      const r2 = buildWinner(row.rank2Name, row.rank2Bib, row.rank2Team, row.rank2Grade, row.rank2Points);
      const r3 = buildWinner(row.rank3Name, row.rank3Bib, row.rank3Team, row.rank3Grade, row.rank3Points);
      const codeLines = fitLines(row.competitionCode, columnWidths[0] - 10).slice(0, 3);
      const competitionLines = fitLines(row.competitionName, columnWidths[1] - 10).slice(0, 4);
      const categoryLines = fitLines((row.categoryName || 'General') + ' | ' + (row.type || 'SOLO'), columnWidths[2] - 10).slice(0, 3);
      const totalLines = fitLines(String(row.eventTotalPoints) + ' pts', columnWidths[6] - 10);
      const longestCellLines = Math.max(
        codeLines.length, competitionLines.length, categoryLines.length, totalLines.length,
        winnerLineCount(r1), winnerLineCount(r2), winnerLineCount(r3)
      );
      const rowHeight = Math.max(38, longestCellLines * 8 + 12);

      if (y + rowHeight > pageHeight - 34) {
        doc.addPage();
        y = drawPageHeader();
      }

      const rowFill = rowIndex % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      let x = margin;
      for (let columnIndex = 0; columnIndex < columnWidths.length; columnIndex += 1) {
        const width = columnWidths[columnIndex];
        doc.setFillColor(rowFill[0], rowFill[1], rowFill[2]);
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, y, width, rowHeight, 'FD');

        if (columnIndex === 3) {
          drawWinnerCell(x, y, width, rowHeight, r1);
        } else if (columnIndex === 4) {
          drawWinnerCell(x, y, width, rowHeight, r2);
        } else if (columnIndex === 5) {
          drawWinnerCell(x, y, width, rowHeight, r3);
        } else {
          const simpleLines = columnIndex === 0 ? codeLines :
            columnIndex === 1 ? competitionLines :
            columnIndex === 2 ? categoryLines : totalLines;
          const fontSize = columnIndex === 1 ? 7.7 : 7.1;
          doc.setFont('helvetica', columnIndex === 0 || columnIndex === 1 || columnIndex === 6 ? 'bold' : 'normal');
          doc.setFontSize(fontSize);
          if (columnIndex === 0) doc.setTextColor(37, 99, 235);
          else if (columnIndex === 6) doc.setTextColor(5, 150, 105);
          else if (columnIndex === 1) doc.setTextColor(17, 24, 39);
          else doc.setTextColor(71, 85, 105);
          const align = columnIndex === 0 || columnIndex === 2 || columnIndex === 6 ? 'center' : 'left';
          const textX = align === 'center' ? x + width / 2 : x + 5;
          const lineHeight = fontSize * 1.15;
          const textY = y + (rowHeight - simpleLines.length * lineHeight) / 2 + fontSize;
          doc.text(simpleLines, textX, textY, { align, lineHeightFactor: 1.1 });
        }
        x += width;
      }
      y += rowHeight;
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('OFFICIAL RESULTS | PUBLISHED COMPETITIONS ONLY', margin, pageHeight - 12);
      doc.text('Page ' + page + ' of ' + totalPages, pageWidth - margin, pageHeight - 12, { align: 'right' });
    }

    const safeName = (festivalName || 'Festival').trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Festival';
    doc.save(filename.endsWith('.pdf') ? filename : safeName + '_Official_Published_Winners_A4.pdf');
  }
}
