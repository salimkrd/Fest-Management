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
import { ExportService } from '@/services/exportService';
import { DataBackupMigrationModal } from '@/components/domain/DataBackupMigrationModal';

type ExportNotice = { tone: 'success' | 'error'; message: string };

export default function ExportManagementPage() {
  const { results, theme, categories, resultsSyncState } = useFest();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'WINNERS' | 'SCORE_REGISTER'>('WINNERS');
  const [printScoreRegisterOpen, setPrintScoreRegisterOpen] = useState(false);
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionInitialized = useRef(false);
  const knownPublishedIds = useRef<Set<string>>(new Set());

  // Keep selection aligned with the authoritative live results snapshot.
  const publishedResults = useMemo(
    () => results.filter(result => result.resultStatus === 'PUBLISHED'),
    [results]
  );
  const publishedIds = useMemo(() => publishedResults.map(result => result.id), [publishedResults]);

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
  const handleExportWinnersExcel = () => {
    if (!ensureExportReady()) return;
    try {
      const rows = ExportService.getOfficialPublishedWinners(selectedResults);
      ExportService.downloadWinnersXLSX(rows, safeFestivalName + '_Official_Published_Winners.xlsx');
      notifyExport('Excel workbook downloaded with a Winners Summary sheet and a Full Details sheet.');
    } catch (error) {
      notifyExport('Excel export failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
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
            <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} onClick={handleExportWinnersExcel} disabled={!canExport}>
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
        </div>

        {activeTab === 'WINNERS' ? (
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

      <style jsx global>{`
        .official-winners-print { display: none; }
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
        }
`}</style>

    </AdminLayout>
  );
}
