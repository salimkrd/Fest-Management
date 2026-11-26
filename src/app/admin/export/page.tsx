'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { TabulationPrintSheet } from '@/components/domain/TabulationPrintSheet';
import {
  FileDown, Printer, FileSpreadsheet, FileText, Search, CheckCircle2, Layers,
  CheckSquare, Square, Trophy, ShieldAlert, ArrowRight, Database, LoaderCircle,
  AlertCircle, RefreshCw, Filter, Award
} from 'lucide-react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { ExportService } from '@/services/exportService';
import { DataBackupMigrationModal } from '@/components/domain/DataBackupMigrationModal';
import { buildParticipantAchievements, selectParticipantAchievementResults } from '@/domain/participantAchievements';

type ExportNotice = { tone: 'success' | 'error'; message: string };

export default function ExportManagementPage() {
  const { results, theme, categories, resultsSyncState, participants, participantsSyncState, registrations, registrationsSyncState } = useFest();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'WINNERS' | 'SCORE_REGISTER' | 'PARTICIPANT_AWARDS'>('WINNERS');
  const [participantAwardSearch, setParticipantAwardSearch] = useState('');
  const [participantAwardTeamFilter, setParticipantAwardTeamFilter] = useState('ALL');
  const [excludeGroupCompetitions, setExcludeGroupCompetitions] = useState(false);
  const [printScoreRegisterOpen, setPrintScoreRegisterOpen] = useState(false);
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isDownloadingParticipantPDF, setIsDownloadingParticipantPDF] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionInitialized = useRef(false);
  const knownPublishedIds = useRef<Set<string>>(new Set());

  // Keep selection aligned with the authoritative live results snapshot.
  const publishedResults = useMemo(
    () => results.filter(result => result.resultStatus === 'PUBLISHED'),
    [results]
  );
  const publishedIds = useMemo(() => publishedResults.map(result => result.id), [publishedResults]);
  const achievementSourceResults = useMemo(
    () => selectParticipantAchievementResults(results, excludeGroupCompetitions),
    [results, excludeGroupCompetitions]
  );
  const participantAchievements = useMemo(
    () => buildParticipantAchievements(participants, registrations, achievementSourceResults),
    [participants, registrations, achievementSourceResults]
  );
  const participantAwardTeamOptions = useMemo(
    () => Array.from(new Set(participants.map(participant => participant.teamName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [participants]
  );
  const filteredParticipantAchievements = useMemo(() => {
    const term = participantAwardSearch.trim().toLowerCase();
    return participantAchievements.filter(entry => {
      const participant = entry.participant;
      const matchesSearch = !term ||
        participant.name.toLowerCase().includes(term) ||
        participant.bib.toLowerCase().includes(term) ||
        participant.teamName.toLowerCase().includes(term) ||
        participant.teamCode.toLowerCase().includes(term);
      return matchesSearch && (participantAwardTeamFilter === 'ALL' || participant.teamName === participantAwardTeamFilter);
    }).sort((a, b) =>
      b.firstCount - a.firstCount ||
      b.secondCount - a.secondCount ||
      b.thirdCount - a.thirdCount ||
      a.participant.name.localeCompare(b.participant.name)
    );
  }, [participantAchievements, participantAwardSearch, participantAwardTeamFilter]);
  const participantAwardTotals = useMemo(
    () => filteredParticipantAchievements.reduce((totals, entry) => ({
      first: totals.first + entry.firstCount,
      second: totals.second + entry.secondCount,
      third: totals.third + entry.thirdCount,
      medals: totals.medals + entry.totalAwards
    }), { first: 0, second: 0, third: 0, medals: 0 }),
    [filteredParticipantAchievements]
  );
  const participantAwardsSyncReady = resultsSyncState === 'ready' &&
    participantsSyncState === 'ready' && registrationsSyncState === 'ready';
  const participantAwardsSyncError = [resultsSyncState, participantsSyncState, registrationsSyncState]
    .some(state => state === 'error' || state === 'idle');


  useEffect(() => {
    if (resultsSyncState !== 'ready') return;
    const availableIds = new Set(publishedIds);
    const newlyPublishedIds = publishedIds.filter(id => !knownPublishedIds.current.has(id));
    knownPublishedIds.current = availableIds;
    setSelectedIds(current => {
      if (!selectionInitialized.current) {
        selectionInitialized.current = true;
        return publishedIds;
      }
      const retained = current.filter(id => availableIds.has(id));
      return Array.from(new Set([...retained, ...newlyPublishedIds]));
    });
  }, [publishedIds, resultsSyncState]);

  useEffect(() => {
    if (!exportNotice) return;
    const timeout = window.setTimeout(() => setExportNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [exportNotice]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return publishedResults.filter(result => {
      const matchesSearch = !term ||
        result.competitionName.toLowerCase().includes(term) ||
        result.competitionCode.toLowerCase().includes(term);
      return matchesSearch && (categoryFilter === 'ALL' || result.categoryName === categoryFilter);
    });
  }, [publishedResults, search, categoryFilter]);
  const selectedResults = useMemo(
    () => publishedResults.filter(result => selectedIdSet.has(result.id)),
    [publishedResults, selectedIdSet]
  );
  const allVisibleSelected = filteredResults.length > 0 &&
    filteredResults.every(result => selectedIdSet.has(result.id));
  const syncIsReady = resultsSyncState === 'ready';
  const canExport = syncIsReady && selectedResults.length > 0;
  const safeFestivalName = (theme.festivalName || 'Festival').trim().replace(/\s+/g, '_') || 'Festival';

  const notifyExport = (message: string, tone: ExportNotice['tone'] = 'success') => {
    setExportNotice({ message, tone });
  };
  const ensureExportReady = () => {
    if (!syncIsReady) {
      notifyExport('Results are not synchronized yet. Wait for the results feed to become ready, then retry.', 'error');
      return false;
    }
    if (selectedResults.length === 0) {
      notifyExport('Select at least one published competition before continuing.', 'error');
      return false;
    }
    return true;
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredResults.map(result => result.id);
    if (visibleIds.length === 0) return;
    setSelectedIds(current => {
      const next = new Set(current);
      const shouldDeselect = visibleIds.every(id => next.has(id));
      visibleIds.forEach(id => shouldDeselect ? next.delete(id) : next.add(id));
      return Array.from(next);
    });
  };
  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  };

  const handleExportWinnersCSV = () => {
    if (!ensureExportReady()) return;
    try {
      const rows = ExportService.getOfficialPublishedWinners(selectedResults);
      ExportService.downloadWinnersCSV(rows, safeFestivalName + '_Official_Published_Winners.csv');
      notifyExport('Official Published Winners CSV downloaded successfully.');
    } catch (error) {
      notifyExport('CSV export failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };
  const handleExportWinnersExcel = async () => {
    if (!ensureExportReady() || isExportingExcel) return;
    try {
      setIsExportingExcel(true);
      const rows = ExportService.getOfficialPublishedWinners(selectedResults);
      await ExportService.downloadWinnersXLSX(rows, safeFestivalName + '_Official_Published_Winners.xlsx');
      notifyExport('Excel workbook downloaded with an Official Winners worksheet.');
    } catch (error) {
      notifyExport('Excel export failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };
  const handleDownloadWinnersPDF = () => {
    if (!ensureExportReady()) return;
    try {
      const rows = ExportService.getOfficialPublishedWinners(selectedResults);
      ExportService.downloadWinnersPDF(
        rows, theme.festivalName, theme.institutionName,
        safeFestivalName + '_Official_Published_Winners.pdf'
      );
      notifyExport('Official Published Winners PDF downloaded successfully.');
    } catch (error) {
      notifyExport('PDF export failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };
  const handlePrintWinnersSheet = () => {
    if (!ensureExportReady()) return;
    const cleanup = () => document.body.classList.remove('print-winners-mode');
    document.body.classList.add('print-winners-mode');
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } catch {
      cleanup();
      notifyExport('The print dialog could not be opened. Please try again.', 'error');
    }
  };

  const handlePrintParticipantAwards = () => {
    if (!participantAwardsSyncReady) {
      notifyExport('Participants, registrations and published results must all be synchronized before printing this report.', 'error');
      return;
    }
    if (filteredParticipantAchievements.length === 0) {
      notifyExport('No participants match the current search or team filter.', 'error');
      return;
    }
    const cleanup = () => document.body.classList.remove('print-participant-awards-mode');
    document.body.classList.add('print-participant-awards-mode');
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } catch {
      cleanup();
      notifyExport('The print dialog could not be opened. Please try again.', 'error');
    }
  };

  const handleDownloadParticipantAwardsPDF = () => {
    if (!participantAwardsSyncReady) {
      notifyExport('Participants, registrations and published results must all be synchronized before downloading this report.', 'error');
      return;
    }
    if (filteredParticipantAchievements.length === 0) {
      notifyExport('No participants match the current search or team filter.', 'error');
      return;
    }
    if (isDownloadingParticipantPDF) return;

    try {
      setIsDownloadingParticipantPDF(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 30;
      const columns = [
        { label: 'NO.', width: 34 },
        { label: 'BIB', width: 58 },
        { label: 'PARTICIPANT NAME', width: 190 },
        { label: 'TEAM / HOUSE', width: 145 },
        { label: '1ST', width: 48 },
        { label: '2ND', width: 48 },
        { label: '3RD', width: 48 },
        { label: 'TOTAL', width: 55 }
      ];
      const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
      const generatedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const title = theme.festivalName || 'Festival';
      const reportTitle = 'Participant Achievement Report' + (excludeGroupCompetitions ? ' - Without Group Competitions' : '');
      const drawHeader = (pageNumber: number) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 66, 'F');
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 7, 66, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(title.toUpperCase(), margin, 26, { maxWidth: pageWidth - margin * 2 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(theme.institutionName || '', margin, 44, { maxWidth: pageWidth - margin * 2 });
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(reportTitle, margin, 88);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(82, 96, 112);
        doc.text(filteredParticipantAchievements.length + ' participants | Generated ' + generatedDate, margin, 102);
        const summaryY = 115;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, summaryY, tableWidth, 27, 3, 3, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        const summary = [
          '1st Positions: ' + participantAwardTotals.first,
          '2nd Positions: ' + participantAwardTotals.second,
          '3rd Positions: ' + participantAwardTotals.third,
          'Total Awards: ' + participantAwardTotals.medals
        ];
        const summaryGap = tableWidth / summary.length;
        summary.forEach((value, index) => doc.text(value, margin + summaryGap * index + 9, summaryY + 17));
        let x = margin;
        const tableY = 151;
        doc.setFillColor(226, 232, 240);
        doc.setDrawColor(203, 213, 225);
        columns.forEach(column => {
          doc.rect(x, tableY, column.width, 23, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);
          doc.text(column.label, x + (column.width > 70 ? 5 : column.width / 2), tableY + 15, { align: column.width > 70 ? 'left' : 'center' });
          x += column.width;
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Page ' + pageNumber, pageWidth - margin, pageHeight - 16, { align: 'right' });
        return tableY + 23;
      };

      let y = drawHeader(1);
      const rowLineHeight = 10;
      filteredParticipantAchievements.forEach((entry, index) => {
        const nameLines = doc.splitTextToSize(entry.participant.name || '-', columns[2].width - 10) as string[];
        const teamLines = doc.splitTextToSize(entry.participant.teamName || entry.participant.teamCode || '-', columns[3].width - 10) as string[];
        const categoryLines = entry.participant.categoryName
          ? doc.splitTextToSize(entry.participant.categoryName, columns[2].width - 10) as string[]
          : [];
        const rowHeight = Math.max(25, (nameLines.length + categoryLines.length) * rowLineHeight + 8, teamLines.length * rowLineHeight + 8);
        if (y + rowHeight > pageHeight - 32) {
          doc.addPage();
          y = drawHeader(doc.getNumberOfPages());
        }
        const values = [
          String(index + 1), entry.participant.bib || '-', '', '',
          String(entry.firstCount), String(entry.secondCount), String(entry.thirdCount), String(entry.totalAwards)
        ];
        let x = margin;
        columns.forEach((column, columnIndex) => {
          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
          doc.rect(x, y, column.width, rowHeight, 'FD');
          doc.setFont('helvetica', columnIndex === 2 || columnIndex === 7 ? 'bold' : 'normal');
          doc.setFontSize(columnIndex === 2 ? 8 : 7.5);
          doc.setTextColor(columnIndex === 7 ? 17 : 51, columnIndex === 7 ? 24 : 65, columnIndex === 7 ? 39 : 85);
          if (columnIndex === 2) {
            doc.text(nameLines, x + 5, y + 11, { lineHeightFactor: 1.05 });
            if (categoryLines.length) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.5);
              doc.setTextColor(100, 116, 139);
              doc.text(categoryLines, x + 5, y + 11 + nameLines.length * rowLineHeight);
            }
          } else if (columnIndex === 3) {
            doc.text(teamLines, x + 5, y + 11, { lineHeightFactor: 1.05 });
          } else {
            doc.text(values[columnIndex], columnIndex < 2 ? x + column.width / 2 : x + column.width / 2, y + rowHeight / 2 + 2, { align: 'center' });
          }
          x += column.width;
        });
        y += rowHeight;
      });

      const note = excludeGroupCompetitions
        ? 'Only officially published solo competition results are included. Group competitions are excluded.'
        : 'Only officially published results are included. Group competition awards are credited to registered group leaders; legacy group member IDs are credited where available.';
      if (y + 22 > pageHeight - 25) {
        doc.addPage();
        y = drawHeader(doc.getNumberOfPages());
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(82, 96, 112);
      doc.text(doc.splitTextToSize(note, tableWidth), margin, y + 14);

      const filename = (theme.festivalName || 'Festival').trim().replace(/\s+/g, '_') + '_Participant_Achievements' + (excludeGroupCompetitions ? '_Without_Groups' : '') + '.pdf';
      doc.save(filename);
      notifyExport('Participant Achievement PDF downloaded successfully.');
    } catch (error) {
      notifyExport('PDF download failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
    } finally {
      setIsDownloadingParticipantPDF(false);
    }
  };

  const handleRetrySync = () => window.location.reload();

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-8">
        <header className="flex flex-col gap-4 border-b border-[#E1E7EF] pb-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                <Trophy className="h-3.5 w-3.5" /> Official records
              </span>
              <span className="text-[11px] font-medium text-[#64748B]">Admin workspace</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">Export &amp; Official Tabulation</h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#64748B] sm:text-sm">
              Prepare accurate records from competitions that have been reviewed and officially published.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[560px]">
            <div className="col-span-2 sm:col-span-1">
              <Button variant="secondary" size="sm" leftIcon={<Database className="h-4 w-4 text-amber-600" />} onClick={() => setMigrationModalOpen(true)}>
                Backup &amp; Migration
              </Button>
            </div>
            <Button variant="outline" size="sm" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrintWinnersSheet} disabled={!canExport}>
              Print View
            </Button>
            <Button variant="outline" size="sm" leftIcon={<FileText className="h-4 w-4 text-red-600" />} onClick={handleDownloadWinnersPDF} disabled={!canExport}>
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              isLoading={isExportingExcel}
              disabled={!canExport || isExportingExcel}
              leftIcon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
              onClick={handleExportWinnersExcel}
            >
              Export XLSX
            </Button>
            <Button variant="primary" size="sm" leftIcon={<FileDown className="h-4 w-4" />} onClick={handleExportWinnersCSV} disabled={!canExport}>
              Export CSV
            </Button>
          </div>
        </header>

        <section
          className={
            'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ' +
            (resultsSyncState === 'ready' ? 'border-emerald-200 bg-emerald-50/70' :
              resultsSyncState === 'error' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50/70')
          }
          aria-live="polite"
        >
          <div className="flex min-w-0 items-start gap-3">
            {resultsSyncState === 'ready' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> :
              resultsSyncState === 'error' || resultsSyncState === 'idle' ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /> :
                <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-600" />}
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1F2937]">
                {resultsSyncState === 'ready' ? 'Results data is synchronized' :
                  resultsSyncState === 'error' ? 'Results synchronization failed' :
                    resultsSyncState === 'idle' ? 'Results synchronization is unavailable' : 'Synchronizing official results…'}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#526070]">
                {resultsSyncState === 'ready'
                  ? 'The published-results feed is ready. New publications and status changes are reflected automatically.'
                  : resultsSyncState === 'error' || resultsSyncState === 'idle'
                    ? 'Export actions are paused so incomplete or stale results are not downloaded.'
                    : 'Export actions will become available after the first authoritative results snapshot arrives.'}
              </p>
            </div>
          </div>
          {resultsSyncState === 'error' || resultsSyncState === 'idle' ? (
            <Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleRetrySync}>Retry sync</Button>
          ) : (
            <span className="shrink-0 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-bold text-[#475569]">
              {resultsSyncState === 'ready' ? 'Live feed ready' : 'Sync in progress'}
            </span>
          )}
        </section>

        {exportNotice && (
          <div
            className={'flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ' +
              (exportNotice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}
            role={exportNotice.tone === 'error' ? 'alert' : 'status'}
          >
            {exportNotice.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> :
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>{exportNotice.message}</span>
          </div>
        )}

        <section className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 text-blue-600 shadow-sm"><ShieldAlert className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-bold text-blue-950">Official Published Winners Focus</h2>
                <span className="text-[11px] font-bold text-blue-700">{publishedResults.length} published {publishedResults.length === 1 ? 'event' : 'events'}</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-blue-900/80">
                Only admin-published results are included. Drafts, results awaiting review, and unpublished revisions are excluded from official exports.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-[#64748B]">Published competitions</span><Layers className="h-4 w-4 text-blue-600" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#111827]">{publishedResults.length}</p>
            <p className="mt-1 text-[10px] text-[#94A3B8]">Officially released results</p>
          </div>
          <div className="rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-[#64748B]">Selected for export</span><CheckSquare className="h-4 w-4 text-emerald-600" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#111827]">{selectedResults.length}</p>
            <p className="mt-1 text-[10px] text-[#94A3B8]">Your current export selection</p>
          </div>
          <div className="rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-[#64748B]">Visible after filters</span><Filter className="h-4 w-4 text-violet-600" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#111827]">{filteredResults.length}</p>
            <p className="mt-1 text-[10px] text-[#94A3B8]">Search and category results</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#E1E7EF] pb-2" role="tablist" aria-label="Export views">
          <button type="button" role="tab" aria-selected={activeTab === 'WINNERS'} onClick={() => setActiveTab('WINNERS')}
            className={'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ' +
              (activeTab === 'WINNERS' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-[#64748B] hover:border-[#E1E7EF] hover:bg-white hover:text-[#111827]')}>
            <Trophy className="h-4 w-4" /> Official Published Winners
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] tabular-nums text-blue-700">{publishedResults.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'SCORE_REGISTER'} onClick={() => setActiveTab('SCORE_REGISTER')}
            className={'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ' +
              (activeTab === 'SCORE_REGISTER' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-[#64748B] hover:border-[#E1E7EF] hover:bg-white hover:text-[#111827]')}>
            <FileText className="h-4 w-4" /> Full Results Register
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'PARTICIPANT_AWARDS'} onClick={() => setActiveTab('PARTICIPANT_AWARDS')}
            className={'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ' +
              (activeTab === 'PARTICIPANT_AWARDS' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-[#64748B] hover:border-[#E1E7EF] hover:bg-white hover:text-[#111827]')}>
            <Award className="h-4 w-4" /> Participant Achievements
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] tabular-nums text-blue-700">{participantAchievements.length}</span>
          </button>
        </div>

        {activeTab === 'PARTICIPANT_AWARDS' ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#111827]">Participant Achievement Summary</h2>
                <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#64748B]">Counts every 1st, 2nd and 3rd position in officially published competitions. Participants without podium positions remain in the report with zero counts. Use “Without Group Competitions” to exclude group-event awards.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<FileText className="h-4 w-4 text-red-600" />} onClick={handleDownloadParticipantAwardsPDF} isLoading={isDownloadingParticipantPDF} disabled={!participantAwardsSyncReady || filteredParticipantAchievements.length === 0 || isDownloadingParticipantPDF}>
                  Download PDF
                </Button>
                <Button variant="primary" size="sm" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrintParticipantAwards} disabled={!participantAwardsSyncReady || filteredParticipantAchievements.length === 0}>
                  Print A4 Report
                </Button>
              </div>
            </div>

            {!participantAwardsSyncReady && (
              <div role={participantAwardsSyncError ? 'alert' : 'status'} className={'rounded-xl border px-4 py-3 text-xs ' + (participantAwardsSyncError ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800')}>
                {participantAwardsSyncError ? 'Participant achievement data could not be synchronized. Retry the page before printing.' : 'Synchronizing participants, registrations and published results… The report will be available when all three feeds are ready.'}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#E1E7EF] bg-white p-3"><span className="block text-[10px] font-semibold text-[#64748B]">Participants listed</span><strong className="mt-1 block text-xl tabular-nums text-[#111827]">{filteredParticipantAchievements.length}</strong></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"><span className="block text-[10px] font-semibold text-amber-800">1st positions</span><strong className="mt-1 block text-xl tabular-nums text-amber-900">{participantAwardTotals.first}</strong></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="block text-[10px] font-semibold text-slate-700">2nd positions</span><strong className="mt-1 block text-xl tabular-nums text-slate-900">{participantAwardTotals.second}</strong></div>
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3"><span className="block text-[10px] font-semibold text-orange-800">3rd positions</span><strong className="mt-1 block text-xl tabular-nums text-orange-900">{participantAwardTotals.third}</strong></div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="relative min-w-0 flex-1 md:max-w-lg">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input type="search" placeholder="Search participant name or bib number…" value={participantAwardSearch} onChange={event => setParticipantAwardSearch(event.target.value)} className="h-10 w-full rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] pl-9 pr-3 text-xs text-[#111827] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <label className="sr-only" htmlFor="participant-award-team-filter">Filter by team</label>
                <select id="participant-award-team-filter" value={participantAwardTeamFilter} onChange={event => setParticipantAwardTeamFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#334155] sm:w-auto sm:min-w-[190px]">
                  <option value="ALL">All teams / houses</option>
                  {participantAwardTeamOptions.map(team => <option key={team} value={team}>{team}</option>)}
                </select>
                <button type="button" aria-pressed={excludeGroupCompetitions} onClick={() => setExcludeGroupCompetitions(value => !value)} className={'inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-bold transition-colors ' + (excludeGroupCompetitions ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-[#DCE3EC] bg-white text-[#475569] hover:bg-[#F8FAFC]')}>Without Group Competitions</button>
                <button type="button" onClick={() => { setParticipantAwardSearch(''); setParticipantAwardTeamFilter('ALL'); setExcludeGroupCompetitions(false); }} className="inline-flex h-10 items-center justify-center rounded-lg border border-[#DCE3EC] bg-white px-3 text-xs font-bold text-[#475569] hover:bg-[#F8FAFC]">Clear filters</button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E1E7EF] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E1E7EF] px-4 py-3">
                <div>
                  <h3 className="text-xs font-bold text-[#111827]">Participant medal counts</h3>
                  <p className="mt-0.5 text-[10px] text-[#64748B]">Sorted by 1st, then 2nd and 3rd positions; row order can change when filters change</p>
                  <p className="mt-1 text-[10px] font-semibold text-blue-700">{excludeGroupCompetitions ? 'Group competitions excluded · solo results only' : 'All published solo and group results included'}</p>
                </div>
                <span className="text-[10px] font-semibold text-[#64748B]">{filteredParticipantAchievements.length} records</span>
              </div>
              {!participantAwardsSyncReady ? (
                <div className="px-4 py-12 text-center text-xs text-[#64748B]">Waiting for synchronized participant records…</div>
              ) : filteredParticipantAchievements.length === 0 ? (
                <div className="px-4 py-12 text-center"><p className="text-sm font-bold text-[#111827]">No participants found</p><p className="mt-1 text-xs text-[#64748B]">Try another name, bib number or team filter.</p></div>
              ) : (
                <>
                <div className="divide-y divide-[#EEF2F6] md:hidden">
                  {filteredParticipantAchievements.map((entry, index) => (
                    <article key={entry.participant.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-5 text-[#111827]">{entry.participant.name}</p>
                          <p className="mt-1 text-[10px] font-semibold text-blue-700">{entry.participant.bib} <span className="font-normal text-[#94A3B8]">·</span> {entry.participant.categoryName || '—'}</p>
                          <p className="mt-1 text-[11px] text-[#64748B]">{entry.participant.teamName || entry.participant.teamCode || '—'}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-[#F8FAFC] px-3 py-2 text-right">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-[#64748B]">Total</span>
                          <strong className="block text-lg tabular-nums text-[#111827]">{entry.totalAwards}</strong>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-amber-50 px-3 py-2 text-center"><span className="block text-[9px] font-bold uppercase text-amber-800">1st</span><strong className="mt-0.5 block text-base tabular-nums text-amber-900">{entry.firstCount}</strong></div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center"><span className="block text-[9px] font-bold uppercase text-slate-700">2nd</span><strong className="mt-0.5 block text-base tabular-nums text-slate-900">{entry.secondCount}</strong></div>
                        <div className="rounded-lg bg-orange-50 px-3 py-2 text-center"><span className="block text-[9px] font-bold uppercase text-orange-800">3rd</span><strong className="mt-0.5 block text-base tabular-nums text-orange-900">{entry.thirdCount}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead><tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                      <th className="px-4 py-3">No.</th><th className="px-4 py-3">Bib</th><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Team / House</th><th className="px-4 py-3 text-center">1st</th><th className="px-4 py-3 text-center">2nd</th><th className="px-4 py-3 text-center">3rd</th><th className="px-4 py-3 text-center">Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#EEF2F6]">
                      {filteredParticipantAchievements.map((entry, index) => (
                        <tr key={entry.participant.id} className="hover:bg-[#FAFBFD]">
                          <td className="px-4 py-3 text-[#94A3B8]">{index + 1}</td>
                          <td className="px-4 py-3 font-mono text-[11px] font-bold text-blue-700">{entry.participant.bib}</td>
                          <td className="px-4 py-3"><strong className="block text-[#111827]">{entry.participant.name}</strong><span className="mt-0.5 block text-[10px] text-[#64748B]">{entry.participant.categoryName || '—'}</span></td>
                          <td className="px-4 py-3 text-[#475569]">{entry.participant.teamName || entry.participant.teamCode || '—'}</td>
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-amber-700">{entry.firstCount}</td>
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-slate-700">{entry.secondCount}</td>
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-orange-700">{entry.thirdCount}</td>
                          <td className="px-4 py-3 text-center font-extrabold tabular-nums text-[#111827]">{entry.totalAwards}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-[#CBD5E1] bg-[#F8FAFC] font-bold text-[#111827]"><td className="px-4 py-3" colSpan={4}>Total awards in current view</td><td className="px-4 py-3 text-center">{participantAwardTotals.first}</td><td className="px-4 py-3 text-center">{participantAwardTotals.second}</td><td className="px-4 py-3 text-center">{participantAwardTotals.third}</td><td className="px-4 py-3 text-center">{participantAwardTotals.medals}</td></tr></tfoot>
                  </table>
                </div>
                </>
              )}
              <div className="border-t border-[#E1E7EF] bg-[#FAFBFD] px-4 py-2.5 text-[10px] leading-4 text-[#64748B]">Only published results are counted. Group event results are credited to the registered group leader; stored legacy group member IDs are also credited where available.</div>
            </div>
          </section>
        ) : activeTab === 'WINNERS' ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm shadow-slate-900/[0.02] md:flex-row md:items-center md:justify-between">
              <div className="relative min-w-0 flex-1 md:max-w-lg">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input type="search" placeholder="Search by competition name or code…" value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] pl-9 pr-3 text-xs text-[#111827] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <label className="sr-only" htmlFor="export-category-filter">Filter by category</label>
                <select id="export-category-filter" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}
                  className="h-10 w-full min-w-0 rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#334155] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-auto sm:min-w-[180px]">
                  <option value="ALL">All categories</option>
                  {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
                <button type="button" onClick={handleToggleSelectAll} disabled={!syncIsReady || filteredResults.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#DCE3EC] bg-white px-3 text-xs font-bold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50">
                  {allVisibleSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                  {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E1E7EF] bg-white shadow-sm shadow-slate-900/[0.02]">
              <div className="flex flex-col gap-1 border-b border-[#E1E7EF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="text-xs font-bold text-[#111827]">Published winners</h2>
                  <p className="mt-0.5 text-[10px] text-[#64748B]">{selectedResults.length} selected of {publishedResults.length} published competitions</p>
                </div>
                <span className="text-[10px] font-semibold text-[#94A3B8]">Selection is preserved while filters change</span>
              </div>

              {resultsSyncState === 'loading' ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                  <LoaderCircle className="h-7 w-7 animate-spin text-blue-600" />
                  <p className="text-xs font-semibold text-[#334155]">Loading published results</p>
                  <p className="text-[11px] text-[#94A3B8]">Waiting for the first synchronized snapshot.</p>
                </div>
              ) : resultsSyncState === 'error' || resultsSyncState === 'idle' ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <h3 className="text-sm font-bold text-[#111827]">Results are not available</h3>
                  <p className="max-w-md text-xs leading-5 text-[#64748B]">Reconnect to the results feed before exporting. The page will not use stale data.</p>
                  <Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleRetrySync}>Retry synchronization</Button>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                  <ShieldAlert className="h-9 w-9 text-amber-500" />
                  <h3 className="text-sm font-bold text-[#111827]">{publishedResults.length === 0 ? 'No published results yet' : 'No competitions match these filters'}</h3>
                  <p className="max-w-md text-xs leading-5 text-[#64748B]">
                    {publishedResults.length === 0
                      ? 'Only reviewed competitions published by an Admin appear in the official export register.'
                      : 'Change the search text or category filter to see other published competitions.'}
                  </p>
                  {publishedResults.length === 0 ? (
                    <Link href="/admin/results" className="mt-2 inline-flex">
                      <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>Go to Results Management</Button>
                    </Link>
                  ) : (
                    <button type="button" onClick={() => { setSearch(''); setCategoryFilter('ALL'); }} className="mt-2 text-xs font-bold text-blue-700 hover:text-blue-800">Clear filters</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 lg:hidden">
                    {filteredResults.map(result => {
                      const first = result.ranks.find(rank => rank.rank === 1);
                      const second = result.ranks.find(rank => rank.rank === 2);
                      const third = result.ranks.find(rank => rank.rank === 3);
                      const points = [first, second, third].reduce((total, rank) =>
                        total + (rank ? (rank.officialPoints ?? rank.totalEarnedPoints ?? 0) : 0), 0);
                      const isSelected = selectedIdSet.has(result.id);
                      const winnerCard = (label: string, winner: typeof first) => (
                        <div className="min-w-0 rounded-lg border border-[#E8EDF3] bg-[#FAFBFD] p-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</span>
                            {winner && <span className="text-[10px] font-bold text-blue-700">Grade {winner.grade}</span>}
                          </div>
                          {winner ? (
                            <>
                              <p className="break-words text-xs font-bold text-[#1F2937]">{winner.candidateName}</p>
                              <p className="mt-1 text-[10px] text-[#64748B]">{winner.teamName} · {winner.teamCode}</p>
                              <p className="mt-1 text-[10px] font-semibold text-emerald-700">+{winner.officialPoints ?? winner.totalEarnedPoints ?? 0} pts</p>
                            </>
                          ) : <p className="text-xs italic text-[#94A3B8]">No prize awarded</p>}
                        </div>
                      );
                      return (
                        <article key={result.id} className={'rounded-xl border p-3 transition-colors ' +
                          (isSelected ? 'border-blue-200 bg-blue-50/20' : 'border-[#E1E7EF] bg-white')}>
                          <div className="flex items-start gap-3">
                            <button type="button" onClick={() => handleToggleSelectOne(result.id)}
                              aria-label={(isSelected ? 'Deselect ' : 'Select ') + result.competitionName} aria-pressed={isSelected}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
                              {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-[#94A3B8]" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">{result.competitionCode}</span>
                                <span className="text-[10px] text-[#64748B]">{result.categoryName} · {result.type}</span>
                              </div>
                              <h3 className="mt-1 break-words text-sm font-bold leading-5 text-[#111827]">{result.competitionName}</h3>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="block text-[9px] font-semibold uppercase text-[#94A3B8]">Event points</span>
                              <span className="text-sm font-extrabold tabular-nums text-[#111827]">{points}</span>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {winnerCard('1st Prize', first)}
                            {winnerCard('2nd Prize', second)}
                            {winnerCard('3rd Prize', third)}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[1080px] text-left text-xs">
                      <thead><tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                        <th className="w-12 px-4 py-3"></th>
                        <th className="px-4 py-3">Competition &amp; category</th>
                        <th className="px-4 py-3">1st prize winner</th>
                        <th className="px-4 py-3">2nd prize winner</th>
                        <th className="px-4 py-3">3rd prize winner</th>
                        <th className="px-4 py-3 text-right">Event points</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[#EEF2F6]">
                        {filteredResults.map(result => {
                          const first = result.ranks.find(rank => rank.rank === 1);
                          const second = result.ranks.find(rank => rank.rank === 2);
                          const third = result.ranks.find(rank => rank.rank === 3);
                          const points = [first, second, third].reduce((total, rank) =>
                            total + (rank ? (rank.officialPoints ?? rank.totalEarnedPoints ?? 0) : 0), 0);
                          const isSelected = selectedIdSet.has(result.id);
                          const desktopWinner = (winner: typeof first) => winner ? (
                            <div className="min-w-[150px]">
                              <span className="block font-bold text-[#1F2937]">{winner.candidateName}</span>
                              <span className="mt-1 block text-[10px] text-[#64748B]">{winner.teamName} · {winner.teamCode}</span>
                              <span className="mt-1 block text-[10px] font-bold text-blue-700">Grade {winner.grade}</span>
                              <span className="mt-0.5 block text-[10px] font-semibold text-emerald-700">+{winner.officialPoints ?? winner.totalEarnedPoints ?? 0} pts</span>
                            </div>
                          ) : <span className="text-[11px] italic text-[#94A3B8]">No prize</span>;
                          return (
                            <tr key={result.id} className={isSelected ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-[#FAFBFD]'}>
                              <td className="px-4 py-4 align-top">
                                <button type="button" onClick={() => handleToggleSelectOne(result.id)}
                                  aria-label={(isSelected ? 'Deselect ' : 'Select ') + result.competitionName} aria-pressed={isSelected}
                                  className="rounded p-0.5 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
                                  {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-[#94A3B8]" />}
                                </button>
                              </td>
                              <td className="max-w-[240px] px-4 py-4 align-top">
                                <span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">{result.competitionCode}</span>
                                <span className="mt-1.5 block font-bold leading-5 text-[#111827]">{result.competitionName}</span>
                                <span className="mt-1 block text-[10px] text-[#64748B]">{result.categoryName} · {result.type}</span>
                              </td>
                              <td className="px-4 py-4 align-top">{desktopWinner(first)}</td>
                              <td className="px-4 py-4 align-top">{desktopWinner(second)}</td>
                              <td className="px-4 py-4 align-top">{desktopWinner(third)}</td>
                              <td className="px-4 py-4 text-right align-top">
                                <span className="text-sm font-extrabold tabular-nums text-[#111827]">{points}</span><span className="ml-1 text-[10px] text-[#64748B]">pts</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1 border-t border-[#E1E7EF] bg-[#FAFBFD] px-4 py-2.5 text-[10px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
                <span>Official register · Published results only</span>
                <span>{selectedResults.length} competition(s) currently selected</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-[#E1E7EF] bg-white p-4 shadow-sm shadow-slate-900/[0.02] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Award className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#111827]">Comprehensive Tabulation Register</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-[#64748B]">
                    Prepare the formal published-results register with candidate names, prize positions, grades, official points, and signature fields.
                  </p>
                </div>
              </div>
              <Button variant="primary" size="sm" leftIcon={<Printer className="h-4 w-4" />}
                onClick={() => setPrintScoreRegisterOpen(true)} disabled={!syncIsReady || publishedResults.length === 0}>
                Open Printable Register
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#E8EDF3] bg-[#FAFBFD] p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Published events</span>
                <span className="mt-1 block text-lg font-bold tabular-nums text-[#111827]">{publishedResults.length}</span>
              </div>
              <div className="rounded-lg border border-[#E8EDF3] bg-[#FAFBFD] p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Register scope</span>
                <span className="mt-1 block text-sm font-bold text-[#111827]">All published results</span>
              </div>
              <div className="rounded-lg border border-[#E8EDF3] bg-[#FAFBFD] p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Document format</span>
                <span className="mt-1 block text-sm font-bold text-[#111827]">A4 print-ready</span>
              </div>
            </div>
            {!syncIsReady && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">The printable register will be available when results synchronization is complete.</p>}
          </section>
        )}

        <TabulationPrintSheet
          isOpen={printScoreRegisterOpen}
          onClose={() => setPrintScoreRegisterOpen(false)}
          results={publishedResults}
          festTitle={theme.festivalName}
          institutionName={theme.institutionName}
        />
        <DataBackupMigrationModal isOpen={migrationModalOpen} onClose={() => setMigrationModalOpen(false)} />
      </div>

      {/* A dedicated print-only document; the admin interface is hidden on paper. */}
      <div id="official-winners-print" className="official-winners-print">
        <header className="official-print-header">
          <div className="official-print-kicker">OFFICIAL FESTIVAL RESULTS</div>
          <h1>{theme.festivalName}</h1>
          <p>{theme.institutionName}</p>
          <div className="official-print-meta">
            <span>Published Winners Register</span>
            <span>{selectedResults.length} selected competitions</span>
            <span>Generated {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </header>
        {selectedResults.length === 0 ? (
          <p>No competitions selected for printing.</p>
        ) : (
          <table className="official-print-table">
            <thead>
              <tr>
                <th className="col-code">Code</th>
                <th className="col-competition">Competition</th>
                <th className="col-category">Category / Type</th>
                <th>1st Prize Winner</th>
                <th>2nd Prize Winner</th>
                <th>3rd Prize Winner</th>
                <th className="col-total">Total Points</th>
              </tr>
            </thead>
            <tbody>
              {selectedResults.map((res) => {
                const first = res.ranks.find(rank => rank.rank === 1);
                const second = res.ranks.find(rank => rank.rank === 2);
                const third = res.ranks.find(rank => rank.rank === 3);
                const total = [first, second, third].reduce((sum, rank) =>
                  sum + (rank ? (rank.officialPoints ?? rank.totalEarnedPoints ?? 0) : 0), 0);
                return (
                  <tr key={res.id}>
                    <td className="print-code">{res.competitionCode}</td>
                    <td className="print-competition">{res.competitionName}</td>
                    <td>{res.categoryName} / {res.type}</td>
                    {[first, second, third].map((winner, index) => (
                      <td key={index}>
                        {winner ? (
                          <div className="print-winner">
                            <strong>{winner.candidateName}</strong>
                            <span>{winner.teamName} [{winner.teamCode}]</span>
                            <small>Bib {winner.bib} | Grade {winner.grade} | +{winner.officialPoints ?? winner.totalEarnedPoints ?? 0} pts</small>
                          </div>
                        ) : <span className="print-empty">-</span>}
                      </td>
                    ))}
                    <td className="print-total">{total} pts</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <footer className="official-print-footer">
          <span>{theme.festivalName} | Official published results</span>
          <span>Generated from the festival management system</span>
        </footer>
      </div>


      <div id="participant-achievements-print" className="participant-achievements-print">
        <header className="participant-award-print-header">
          <div className="participant-award-print-kicker">OFFICIAL FESTIVAL RECORDS</div>
          <h1>{theme.festivalName || 'Festival'}</h1>
          <p>{theme.institutionName}</p>
          <div className="participant-award-print-meta">
            <span>Participant Achievement Report{excludeGroupCompetitions ? ' — Without Group Competitions' : ''}</span>
            <span>{filteredParticipantAchievements.length} participants</span>
            <span>Generated {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </header>
        <div className="participant-award-print-summary">
          <span>1st Positions: <strong>{participantAwardTotals.first}</strong></span>
          <span>2nd Positions: <strong>{participantAwardTotals.second}</strong></span>
          <span>3rd Positions: <strong>{participantAwardTotals.third}</strong></span>
          <span>Total Awards: <strong>{participantAwardTotals.medals}</strong></span>
        </div>
        <table className="participant-award-print-table">
          <thead><tr><th>No.</th><th>Bib</th><th>Participant Name</th><th>Team / House</th><th>1st</th><th>2nd</th><th>3rd</th><th>Total</th></tr></thead>
          <tbody>
            {filteredParticipantAchievements.map((entry, index) => (
              <tr key={entry.participant.id}>
                <td>{index + 1}</td>
                <td className="award-print-bib">{entry.participant.bib}</td>
                <td><strong>{entry.participant.name}</strong><small>{entry.participant.categoryName || ''}</small></td>
                <td>{entry.participant.teamName || entry.participant.teamCode || '—'}</td>
                <td className="award-print-count">{entry.firstCount}</td>
                <td className="award-print-count">{entry.secondCount}</td>
                <td className="award-print-count">{entry.thirdCount}</td>
                <td className="award-print-total">{entry.totalAwards}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colSpan={4}>Total awards</th><th>{participantAwardTotals.first}</th><th>{participantAwardTotals.second}</th><th>{participantAwardTotals.third}</th><th>{participantAwardTotals.medals}</th></tr></tfoot>
        </table>
        <p className="participant-award-print-note">Only officially published competition results are included.{excludeGroupCompetitions ? ' Group competitions are excluded from this report.' : ' Group competition awards are credited to the registered group leader; stored legacy group member IDs are also credited where available.'}</p>
        <footer className="participant-award-print-footer"><span>{theme.festivalName} | Participant Achievement Report</span><span>Generated from official published results</span></footer>
      </div>

      <style jsx global>{`
        .official-winners-print, .participant-achievements-print { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body.print-winners-mode, body.print-winners-mode * { visibility: hidden !important; }
          body.print-winners-mode #official-winners-print,
          body.print-winners-mode #official-winners-print * { visibility: visible !important; }
          body.print-winners-mode { background: #fff !important; }
          body.print-winners-mode #official-winners-print {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 8pt !important;
            z-index: 999999 !important;
          }
          .official-print-header {
            border-bottom: 2px solid #2563eb;
            padding: 0 0 10px 0;
            margin-bottom: 12px;
          }
          .official-print-kicker {
            color: #2563eb;
            font-size: 7pt;
            font-weight: 700;
            letter-spacing: 1.5px;
          }
          .official-print-header h1 {
            margin: 4px 0 2px;
            font-size: 18pt;
            line-height: 1.15;
            font-weight: 800;
            text-transform: uppercase;
          }
          .official-print-header p {
            margin: 0;
            color: #475569;
            font-size: 9pt;
          }
          .official-print-meta {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 8px;
            color: #475569;
            font-size: 7pt;
          }
          .official-print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .official-print-table thead { display: table-header-group; }
          .official-print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .official-print-table th {
            background: #e2e8f0 !important;
            color: #334155 !important;
            text-transform: uppercase;
            font-size: 6.5pt;
            font-weight: 800;
            letter-spacing: .2px;
            text-align: left;
          }
          .official-print-table th,
          .official-print-table td {
            border: 1px solid #cbd5e1;
            padding: 5px;
            vertical-align: top;
            overflow-wrap: anywhere;
          }
          .official-print-table td { font-size: 7pt; line-height: 1.25; }
          .official-print-table tbody tr:nth-child(even) { background: #f8fafc !important; }
          .official-print-table .col-code { width: 7%; }
          .official-print-table .col-competition { width: 16%; }
          .official-print-table .col-category { width: 9%; }
          .official-print-table .col-total { width: 8%; text-align: right; }
          .print-code { color: #2563eb; font-weight: 800; }
          .print-competition { font-weight: 700; }
          .print-winner strong,
          .print-winner span,
          .print-winner small { display: block; }
          .print-winner strong { color: #111827; font-size: 7.2pt; }
          .print-winner span { color: #475569; margin-top: 2px; }
          .print-winner small { color: #2563eb; margin-top: 3px; font-size: 6pt; }
          .print-empty { color: #94a3b8; }
          .print-total { text-align: right; color: #047857; font-weight: 800; }
          .official-print-footer {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 10px;
            border-top: 1px solid #cbd5e1;
            padding-top: 5px;
            color: #64748b;
            font-size: 6.5pt;
          }
          body.print-participant-awards-mode,
          body.print-participant-awards-mode * { visibility: hidden !important; }
          body.print-participant-awards-mode #participant-achievements-print,
          body.print-participant-awards-mode #participant-achievements-print * { visibility: visible !important; }
          body.print-participant-awards-mode { background: #fff !important; }
          body.print-participant-awards-mode #participant-achievements-print {
            display: block !important; position: absolute !important; top: 0 !important; left: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 0 !important;
            background: #fff !important; color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important; font-size: 8pt !important; z-index: 999999 !important;
          }
          .participant-award-print-header { border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
          .participant-award-print-kicker { color: #1d4ed8; font-size: 7pt; font-weight: 800; letter-spacing: 1.4px; }
          .participant-award-print-header h1 { margin: 4px 0 2px; font-size: 18pt; font-weight: 800; text-transform: uppercase; }
          .participant-award-print-header p { margin: 0; color: #475569; font-size: 9pt; }
          .participant-award-print-meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; color: #475569; font-size: 7pt; }
          .participant-award-print-summary { display: flex; justify-content: space-between; gap: 12px; padding: 7px 9px; margin-bottom: 10px; border: 1px solid #cbd5e1; background: #f8fafc !important; font-size: 7.5pt; }
          .participant-award-print-summary strong { font-size: 9pt; color: #111827; }
          .participant-award-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .participant-award-print-table thead { display: table-header-group; }
          .participant-award-print-table tr { break-inside: avoid; page-break-inside: avoid; }
          .participant-award-print-table th { background: #e2e8f0 !important; color: #334155 !important; text-transform: uppercase; font-size: 6.8pt; font-weight: 800; }
          .participant-award-print-table th,
          .participant-award-print-table td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: middle; overflow-wrap: anywhere; }
          .participant-award-print-table td { font-size: 7.5pt; line-height: 1.2; }
          .participant-award-print-table tbody tr:nth-child(even) { background: #f8fafc !important; }
          .participant-award-print-table th:nth-child(1) { width: 5%; }
          .participant-award-print-table th:nth-child(2) { width: 9%; }
          .participant-award-print-table th:nth-child(3) { width: 28%; }
          .participant-award-print-table th:nth-child(4) { width: 24%; }
          .participant-award-print-table th:nth-child(n+5) { width: 8.5%; text-align: center; }
          .participant-award-print-table td:nth-child(n+5) { text-align: center; font-weight: 700; }
          .participant-award-print-table td small { display: block; color: #64748b; margin-top: 2px; font-size: 6.5pt; }
          .award-print-bib { color: #1d4ed8; font-family: monospace; font-weight: 800; }
          .award-print-count { color: #334155; }
          .award-print-total { color: #111827; font-weight: 900; }
          .participant-award-print-table tfoot th { border-top: 2px solid #94a3b8; font-size: 7.5pt; }
          .participant-award-print-note { margin-top: 8px; color: #475569; font-size: 6.5pt; line-height: 1.3; }
          .participant-award-print-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 5px; color: #64748b; font-size: 6.5pt; }
        }
`}</style>

    </AdminLayout>
  );
}
