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

    const dataForSheet = rows.map(r => ({
      'Competition Code': r.competitionCode,
      'Competition Name': r.competitionName,
      'Category': r.categoryName,
      'Event Type': r.type,
      '1st Place Winner': r.rank1Name,
      '1st Bib': r.rank1Bib,
      '1st Team': r.rank1Team,
      '1st Grade': r.rank1Grade,
      '1st Points': r.rank1Points,
      '2nd Place Winner': r.rank2Name,
      '2nd Bib': r.rank2Bib,
      '2nd Team': r.rank2Team,
      '2nd Grade': r.rank2Grade,
      '2nd Points': r.rank2Points,
      '3rd Place Winner': r.rank3Name,
      '3rd Bib': r.rank3Bib,
      '3rd Team': r.rank3Team,
      '3rd Grade': r.rank3Grade,
      '3rd Points': r.rank3Points,
      'Event Total Points': r.eventTotalPoints
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 14 }, // Code
      { wch: 28 }, // Name
      { wch: 14 }, // Cat
      { wch: 10 }, // Type
      { wch: 24 }, // 1st Name
      { wch: 10 }, // 1st Bib
      { wch: 18 }, // 1st Team
      { wch: 10 }, // 1st Grade
      { wch: 10 }, // 1st Pts
      { wch: 24 }, // 2nd Name
      { wch: 10 }, // 2nd Bib
      { wch: 18 }, // 2nd Team
      { wch: 10 }, // 2nd Grade
      { wch: 10 }, // 2nd Pts
      { wch: 24 }, // 3rd Name
      { wch: 10 }, // 3rd Bib
      { wch: 18 }, // 3rd Team
      { wch: 10 }, // 3rd Grade
      { wch: 10 }, // 3rd Pts
      { wch: 14 }  // Total Pts
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Official Winners');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

    // Landscape orientation for comprehensive data table
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Header Section
    doc.setFillColor(37, 99, 235); // Blue #2563EB
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(festivalName.toUpperCase(), 30, 28);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${institutionName}  |  OFFICIAL PUBLISHED RESULTS TABULATION DIRECTORY`, 30, 46);

    const todayStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    doc.text(`Generated: ${todayStr}`, pageWidth - 140, 46);

    // 2. Table Column Positions
    const startY = 85;
    let y = startY;
    const rowHeight = 26;

    // Table Header
    doc.setFillColor(241, 245, 249); // #F1F5F9
    doc.rect(30, y, pageWidth - 60, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(30, y, pageWidth - 60, 22, 'S');

    doc.setTextColor(17, 17, 17);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);

    doc.text('CODE', 35, y + 14);
    doc.text('COMPETITION', 80, y + 14);
    doc.text('CATEGORY', 220, y + 14);
    doc.text('1ST PLACE (GOLD)', 290, y + 14);
    doc.text('2ND PLACE (SILVER)', 460, y + 14);
    doc.text('3RD PLACE (BRONZE)', 630, y + 14);
    doc.text('TOTAL', pageWidth - 65, y + 14, { align: 'right' });

    y += 24;

    // Rows
    rows.forEach((row, index) => {
      // Check page overflow
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 40;
      }

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(30, y, pageWidth - 60, rowHeight, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(30, y + rowHeight, pageWidth - 30, y + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text(row.competitionCode, 35, y + 16);

      doc.setTextColor(17, 17, 17);
      doc.text(row.competitionName.substring(0, 26), 80, y + 16);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${row.categoryName} (${row.type})`, 220, y + 16);

      // Rank 1
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 17, 17);
      const r1Short = row.rank1Name !== '-' ? `${row.rank1Name.substring(0, 16)}` : '-';
      doc.text(r1Short, 290, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const r1Sub = row.rank1Name !== '-' ? `${row.rank1Team} | Gr: ${row.rank1Grade} | +${row.rank1Points}p` : '';
      doc.text(r1Sub, 290, y + 21);

      // Rank 2
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 17, 17);
      const r2Short = row.rank2Name !== '-' ? `${row.rank2Name.substring(0, 16)}` : '-';
      doc.text(r2Short, 460, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const r2Sub = row.rank2Name !== '-' ? `${row.rank2Team} | Gr: ${row.rank2Grade} | +${row.rank2Points}p` : '';
      doc.text(r2Sub, 460, y + 21);

      // Rank 3
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 17, 17);
      const r3Short = row.rank3Name !== '-' ? `${row.rank3Name.substring(0, 16)}` : '-';
      doc.text(r3Short, 630, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const r3Sub = row.rank3Name !== '-' ? `${row.rank3Team} | Gr: ${row.rank3Grade} | +${row.rank3Points}p` : '';
      doc.text(r3Sub, 630, y + 21);

      // Event Total Points
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105); // Green
      doc.text(`+${row.eventTotalPoints}`, pageWidth - 65, y + 16, { align: 'right' });

      y += rowHeight;
    });

    // 3. Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Official accredited record issued by the Tabulation Committee. Confirmed and published by Chief Festival Authority.',
      30,
      pageHeight - 20
    );

    doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  }
}
