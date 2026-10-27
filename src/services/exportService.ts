/**
 * Official Export Service
 * Strictly filters for PUBLISHED competition results when exporting official winners.
 * Generates genuine downloadable CSV, XLSX (OpenXML), and PDF files.
 */

import { CompetitionResult } from '@/types/fest';
import * as XLSX from 'xlsx';
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
    const header = 'Competition Code,Competition Name,Category,Type,1st Winner,1st Bib,1st Team,1st Grade,1st Points,2nd Winner,2nd Bib,2nd Team,2nd Grade,2nd Points,3rd Winner,3rd Bib,3rd Team,3rd Grade,3rd Points,Event Total Points\n';

    const lines = rows.map(r => 
      `"${r.competitionCode}","${r.competitionName}","${r.categoryName}","${r.type}","${r.rank1Name}","${r.rank1Bib}","${r.rank1Team}","${r.rank1Grade}",${r.rank1Points},"${r.rank2Name}","${r.rank2Bib}","${r.rank2Team}","${r.rank2Grade}",${r.rank2Points},"${r.rank3Name}","${r.rank3Bib}","${r.rank3Team}","${r.rank3Grade}",${r.rank3Points},${r.eventTotalPoints}`
    );

    return header + lines.join('\n');
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
   * Generates and triggers download of a genuine OpenXML XLSX spreadsheet (.xlsx).
   */
  static downloadWinnersXLSX(rows: PublishedWinnerRow[], filename: string): void {
    if (typeof window === 'undefined') return;

    const winnerCell = (name: string, team: string, bib: string, grade: string, points: number) => {
      if (!name || name === '-') return '-';
      return name + '\n' + team + '\nBib: ' + bib + ' | Grade: ' + grade + ' | +' + points + ' pts';
    };

    // A concise first sheet is easier to read, share, and print.
    const summaryData = rows.map(row => ({
      'Competition Code': row.competitionCode,
      'Competition': row.competitionName,
      'Category': row.categoryName,
      'Type': row.type,
      '1st Prize Winner': winnerCell(row.rank1Name, row.rank1Team, row.rank1Bib, row.rank1Grade, row.rank1Points),
      '2nd Prize Winner': winnerCell(row.rank2Name, row.rank2Team, row.rank2Bib, row.rank2Grade, row.rank2Points),
      '3rd Prize Winner': winnerCell(row.rank3Name, row.rank3Team, row.rank3Bib, row.rank3Grade, row.rank3Points),
      'Total Points': row.eventTotalPoints
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [
      { wch: 16 }, { wch: 34 }, { wch: 18 }, { wch: 10 },
      { wch: 38 }, { wch: 38 }, { wch: 38 }, { wch: 14 }
    ];
    summarySheet['!rows'] = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 48 }))];
    if (summaryData.length > 0) summarySheet['!autofilter'] = { ref: 'A1:H' + (summaryData.length + 1) };

    // Preserve the fully separated fields in a second sheet for analysis.
    const detailData = rows.map(row => ({
      'Competition Code': row.competitionCode,
      'Competition Name': row.competitionName,
      'Category': row.categoryName,
      'Event Type': row.type,
      '1st Place Winner': row.rank1Name,
      '1st Bib': row.rank1Bib,
      '1st Team': row.rank1Team,
      '1st Grade': row.rank1Grade,
      '1st Points': row.rank1Points,
      '2nd Place Winner': row.rank2Name,
      '2nd Bib': row.rank2Bib,
      '2nd Team': row.rank2Team,
      '2nd Grade': row.rank2Grade,
      '2nd Points': row.rank2Points,
      '3rd Place Winner': row.rank3Name,
      '3rd Bib': row.rank3Bib,
      '3rd Team': row.rank3Team,
      '3rd Grade': row.rank3Grade,
      '3rd Points': row.rank3Points,
      'Event Total Points': row.eventTotalPoints
    }));
    const detailSheet = XLSX.utils.json_to_sheet(detailData);
    detailSheet['!cols'] = [
      { wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 10 },
      { wch: 26 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
      { wch: 26 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
      { wch: 26 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 16 }
    ];
    if (detailData.length > 0) detailSheet['!autofilter'] = { ref: 'A1:T' + (detailData.length + 1) };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Winners Summary');
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Full Details');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }


  /**
   * Creates an A4 landscape winners report with a clear hierarchy, repeating
   * table headers, dynamic row heights, and page numbering.
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
