import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export interface TeamResultExportRow {
  competitionCode: string;
  competitionName: string;
  categoryName: string;
  type: string;
  stageName: string;
  candidateName: string;
  bib: string;
  grade: string;
  rank: 1 | 2 | 3 | null;
  points: number;
  publishedDate: string;
}

const rankLabel = (rank: TeamResultExportRow['rank']): string => {
  if (rank === 1) return '1st Place';
  if (rank === 2) return '2nd Place';
  if (rank === 3) return '3rd Place';
  return 'Grade-only / No Prize';
};

const safeFilename = (value: string): string =>
  value.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Team';

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export class TeamExportService {
  static generateCSV(rows: TeamResultExportRow[]): string {
    const headers = [
      'Competition Code', 'Competition', 'Category', 'Type', 'Stage / Venue',
      'Contestant / Group', 'Bib', 'Grade', 'Prize Rank', 'Team Points', 'Published Date'
    ];
    const escape = (value: string | number) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const lines = rows.map(row => [
      row.competitionCode, row.competitionName, row.categoryName, row.type, row.stageName,
      row.candidateName, row.bib, row.grade, rankLabel(row.rank), row.points, row.publishedDate
    ].map(escape).join(','));
    return '\uFEFF' + headers.map(escape).join(',') + '\r\n' + lines.join('\r\n');
  }

  static downloadCSV(rows: TeamResultExportRow[], filename: string): void {
    downloadBlob(new Blob([this.generateCSV(rows)], { type: 'text/csv;charset=utf-8;' }),
      filename.endsWith('.csv') ? filename : filename + '.csv');
  }

  static downloadXLSX(
    rows: TeamResultExportRow[],
    teamName: string,
    teamCode: string,
    festivalName: string,
    filename: string
  ): void {
    const detailData = rows.map((row, index) => ({
      '#': index + 1,
      'Competition Code': row.competitionCode,
      'Competition': row.competitionName,
      'Category': row.categoryName,
      'Type': row.type,
      'Stage / Venue': row.stageName,
      'Contestant / Group': row.candidateName,
      'Bib': row.bib,
      'Grade': row.grade,
      'Prize Rank': rankLabel(row.rank),
      'Team Points': row.points,
      'Published Date': row.publishedDate
    }));
    const detailSheet = XLSX.utils.json_to_sheet(detailData);
    detailSheet['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 10 },
      { wch: 24 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 18 }
    ];
    detailSheet['!rows'] = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 22 }))];
    if (detailData.length > 0) {
      detailSheet['!autofilter'] = { ref: 'A1:L' + (detailData.length + 1) };
    }

    const totalPoints = rows.reduce((total, row) => total + row.points, 0);
    const firsts = rows.filter(row => row.rank === 1).length;
    const seconds = rows.filter(row => row.rank === 2).length;
    const thirds = rows.filter(row => row.rank === 3).length;
    const summaryData = [
      { Metric: 'Festival', Value: festivalName },
      { Metric: 'Team', Value: teamName + ' (' + teamCode + ')' },
      { Metric: 'Published Placings / Entries', Value: rows.length },
      { Metric: '1st Place', Value: firsts },
      { Metric: '2nd Place', Value: seconds },
      { Metric: '3rd Place', Value: thirds },
      { Metric: 'Points in this export', Value: totalPoints },
      { Metric: 'Generated On', Value: new Date().toLocaleDateString('en-GB') }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 28 }, { wch: 44 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Team Summary');
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'My Team Results');
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
  }

  static downloadPDF(
    rows: TeamResultExportRow[],
    teamName: string,
    teamCode: string,
    festivalName: string,
    institutionName: string,
    filename: string
  ): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 26;
    const usableWidth = pageWidth - margin * 2;
    const widths = [55, 135, 140, 45, 80, 75, 68, 60, 95];
    const labels = ['CODE', 'COMPETITION', 'CONTESTANT / GROUP', 'BIB', 'CATEGORY / TYPE', 'STAGE', 'RANK', 'GRADE', 'POINTS'];
    const wrap = (value: string, width: number, maxLines = 3): string[] =>
      (doc.splitTextToSize(value || '-', width) as string[]).slice(0, maxLines);
    const generatedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const drawHeader = (): number => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 62, 'F');
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 7, 62, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      let titleSize = 15;
      while (doc.getTextWidth((festivalName || 'FESTIVAL').toUpperCase()) > usableWidth - 190 && titleSize > 9) {
        titleSize -= 0.5;
        doc.setFontSize(titleSize);
      }
      doc.text((festivalName || 'FESTIVAL').toUpperCase(), margin, 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text((institutionName || 'Festival Institution') + ' | TEAM RESULTS REGISTER', margin, 42);
      doc.text(teamName + ' (' + teamCode + ')', margin, 54);
      doc.text('Generated: ' + generatedDate, pageWidth - margin, 42, { align: 'right' });

      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('MY TEAM — PUBLISHED RESULTS', margin, 82);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(82, 96, 112);
      doc.setFontSize(7.5);
      doc.text(rows.length + ' team result entries | Points in export: ' + rows.reduce((sum, row) => sum + row.points, 0), margin, 96);

      let x = margin;
      const headerY = 106;
      const headerHeight = 22;
      labels.forEach((label, index) => {
        doc.setFillColor(226, 232, 240);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, headerY, widths[index], headerHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(51, 65, 85);
        const centered = [0, 3, 6, 7, 8].includes(index);
        doc.text(label, centered ? x + widths[index] / 2 : x + 4, headerY + 14, { align: centered ? 'center' : 'left' });
        x += widths[index];
      });
      return headerY + headerHeight;
    };

    let y = drawHeader();
    rows.forEach((row, index) => {
      const cells = [
        wrap(row.competitionCode, widths[0] - 8),
        wrap(row.competitionName, widths[1] - 8, 4),
        wrap(row.candidateName, widths[2] - 8, 4),
        wrap(row.bib, widths[3] - 8, 2),
        wrap(row.categoryName + ' / ' + row.type, widths[4] - 8, 3),
        wrap(row.stageName, widths[5] - 8, 3),
        wrap(rankLabel(row.rank), widths[6] - 8, 3),
        wrap(row.grade, widths[7] - 8, 2),
        wrap(String(row.points), widths[8] - 8, 2)
      ];
      const maxLines = Math.max(...cells.map(cell => cell.length));
      const rowHeight = Math.max(30, maxLines * 8 + 10);
      if (y + rowHeight > pageHeight - 32) {
        doc.addPage();
        y = drawHeader();
      }

      let x = margin;
      cells.forEach((cell, columnIndex) => {
        doc.setFillColor(...(index % 2 === 0 ? [255, 255, 255] as [number, number, number] : [248, 250, 252] as [number, number, number]));
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, y, widths[columnIndex], rowHeight, 'FD');
        const centered = [0, 3, 6, 7, 8].includes(columnIndex);
        doc.setFont('helvetica', columnIndex === 0 || columnIndex === 2 ? 'bold' : 'normal');
        doc.setFontSize(columnIndex === 2 ? 7.2 : 6.9);
        doc.setTextColor(columnIndex === 0 ? 37 : 51, columnIndex === 0 ? 99 : 65, columnIndex === 0 ? 235 : 85);
        const fontSize = columnIndex === 2 ? 7.2 : 6.9;
        const textY = y + (rowHeight - cell.length * fontSize * 1.12) / 2 + fontSize;
        doc.text(cell, centered ? x + widths[columnIndex] / 2 : x + 4, textY, {
          align: centered ? 'center' : 'left',
          lineHeightFactor: 1.12
        });
        x += widths[columnIndex];
      });
      y += rowHeight;
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text(teamName + ' (' + teamCode + ') | Published team results only', margin, pageHeight - 12);
      doc.text('Page ' + page + ' of ' + totalPages, pageWidth - margin, pageHeight - 12, { align: 'right' });
    }

    doc.save(filename.endsWith('.pdf') ? filename : safeFilename(teamCode || teamName) + '_Team_Results_A4.pdf');
  }
}
