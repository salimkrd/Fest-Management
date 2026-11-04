'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { calculateTopScorers, type TopScorerRow } from '@/domain/topScorers';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Filter,
  Info,
  LoaderCircle,
  Medal,
  Mic2,
  RefreshCw,
  Search,
  Trophy,
  Users
} from 'lucide-react';

type PerformanceMode = 'STAGE' | 'OFF_STAGE';

function PositionBadge({ position }: { position: number }) {
  const isFirst = position === 1;
  const isSecond = position === 2;
  const isThird = position === 3;

  return (
    <span className={[
      'inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-xs font-extrabold tabular-nums',
      isFirst ? 'border-amber-200 bg-amber-50 text-amber-800' :
        isSecond ? 'border-slate-200 bg-slate-100 text-slate-700' :
          isThird ? 'border-orange-200 bg-orange-50 text-orange-800' :
            'border-[#E5EAF1] bg-[#F8FAFC] text-[#526070]'
    ].join(' ')}>
      {isFirst && <Medal className="mr-1 h-3.5 w-3.5" />}
      #{position}
    </span>
  );
}

function ScorerTable({ rows }: { rows: TopScorerRow[] }) {
  return (
    <>
      <div className="grid gap-3 p-3 md:hidden">
        {rows.map(row => (
          <article key={row.participantId} className={[
            'rounded-xl border p-3.5',
            row.position === 1 ? 'border-amber-200 bg-amber-50/40' : 'border-[#E5EAF1] bg-white'
          ].join(' ')}>
            <div className="flex min-w-0 items-start gap-3">
              <PositionBadge position={row.position} />
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-sm font-bold leading-5 text-[#111827]">{row.name}</h3>
                <p className="mt-1 text-[11px] text-[#64748B]">
                  {row.bib || 'No bib'} <span className="px-1 text-[#CBD5E1]">·</span> {row.categoryName || 'Uncategorized'}
                </p>
                <p className="mt-1 break-words text-xs font-medium text-[#475569]">
                  {row.teamName || 'Unassigned team'} {row.teamCode ? '(' + row.teamCode + ')' : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Total</span>
                <span className="text-base font-extrabold tabular-nums text-[#1D4ED8]">{row.totalMarks.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-[#E5EAF1] rounded-lg border border-[#E8EDF3] bg-white">
              <div className="px-2 py-2 text-center">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">Events</span>
                <span className="mt-0.5 block text-sm font-bold tabular-nums text-[#1F2937]">{row.competitionsCount}</span>
              </div>
              <div className="px-2 py-2 text-center">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">Average</span>
                <span className="mt-0.5 block text-sm font-bold tabular-nums text-[#1F2937]">{row.averagePercentage.toFixed(2)}</span>
              </div>
              <div className="px-2 py-2 text-center">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">Total marks</span>
                <span className="mt-0.5 block text-sm font-bold tabular-nums text-[#1F2937]">{row.totalMarks.toFixed(2)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="border-y border-[#E8EDF3] bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
              <th className="w-24 px-4 py-3.5">Position</th>
              <th className="min-w-[220px] px-4 py-3.5">Participant</th>
              <th className="min-w-[180px] px-4 py-3.5">Team</th>
              <th className="px-4 py-3.5 text-right">Events</th>
              <th className="px-4 py-3.5 text-right">Average / 100</th>
              <th className="px-4 py-3.5 text-right">Total marks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {rows.map(row => (
              <tr key={row.participantId} className={row.position === 1 ? 'bg-amber-50/30' : 'hover:bg-[#FAFBFD]'}>
                <td className="px-4 py-4 align-middle"><PositionBadge position={row.position} /></td>
                <td className="px-4 py-4 align-middle">
                  <span className="block font-bold text-[#111827]">{row.name}</span>
                  <span className="mt-1 block text-[10px] text-[#64748B]">
                    {row.bib || 'No bib'} <span className="px-1 text-[#CBD5E1]">·</span> {row.categoryName || 'Uncategorized'}
                  </span>
                </td>
                <td className="px-4 py-4 align-middle">
                  <span className="block font-semibold text-[#334155]">{row.teamName || 'Unassigned team'}</span>
                  <span className="mt-1 block text-[10px] text-[#64748B]">{row.teamCode || '—'}</span>
                </td>
                <td className="px-4 py-4 text-right align-middle font-semibold tabular-nums text-[#334155]">{row.competitionsCount}</td>
                <td className="px-4 py-4 text-right align-middle font-semibold tabular-nums text-[#334155]">{row.averagePercentage.toFixed(2)}</td>
                <td className="px-4 py-4 text-right align-middle text-sm font-extrabold tabular-nums text-[#1D4ED8]">{row.totalMarks.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AwardOverviewCard({
  title,
  subtitle,
  mode,
  rows,
  active,
  onSelect
}: {
  title: string;
  subtitle: string;
  mode: PerformanceMode;
  rows: TopScorerRow[];
  active: boolean;
  onSelect: (mode: PerformanceMode) => void;
}) {
  const leaders = rows.filter(row => row.position === 1);
  const leaderNames = leaders.slice(0, 2).map(row => row.name).join(' · ');
  const extraLeaders = Math.max(0, leaders.length - 2);
  const isStage = mode === 'STAGE';
  const Icon = isStage ? Mic2 : BookOpen;

  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      aria-pressed={active}
      className={[
        'group min-w-0 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all sm:p-5',
        active ? 'border-blue-300 ring-2 ring-blue-100' : 'border-[#E5EAF1] hover:border-blue-200 hover:shadow-md'
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          isStage ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
        ].join(' ')}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">{subtitle}</p>
          <h2 className="mt-0.5 text-base font-extrabold text-[#111827]">{title}</h2>
        </div>
        <span className="rounded-full border border-[#E8EDF3] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-bold text-[#64748B]">
          {rows.length} ranked
        </span>
      </div>
      <div className="mt-5 border-t border-[#EEF2F6] pt-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
          {leaders.length > 1 ? 'Joint leaders' : 'Current leader'}
        </p>
        {leaders.length ? (
          <>
            <p className="mt-1.5 break-words text-sm font-bold leading-5 text-[#1F2937]">
              {leaderNames}{extraLeaders > 0 ? ' +' + extraLeaders + ' more' : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#64748B]">{leaders[0].teamName}</span>
              <span className="text-sm font-extrabold tabular-nums text-blue-700">{leaders[0].totalMarks.toFixed(2)} marks</span>
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-[#94A3B8]">Awaiting eligible published results</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-blue-700">
        <span>View ranking</span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </button>
  );
}

export default function TopScorersPage() {
  const {
    competitions,
    results,
    registrations,
    participants,
    topScorersSyncState
  } = useFest();
  const [activeMode, setActiveMode] = useState<PerformanceMode>('STAGE');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const stageRows = useMemo(
    () => calculateTopScorers('STAGE', competitions, results, registrations, participants),
    [competitions, results, registrations, participants]
  );
  const offStageRows = useMemo(
    () => calculateTopScorers('OFF_STAGE', competitions, results, registrations, participants),
    [competitions, results, registrations, participants]
  );

  const activeRows = activeMode === 'STAGE' ? stageRows : offStageRows;
  const categories = useMemo(
    () => Array.from(new Set(activeRows.map(row => row.categoryName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activeRows]
  );
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeRows.filter(row => {
      const matchesSearch = !term || [
        row.name,
        row.bib,
        row.teamName,
        row.teamCode,
        row.categoryName
      ].some(value => (value || '').toLowerCase().includes(term));
      return matchesSearch && (categoryFilter === 'ALL' || row.categoryName === categoryFilter);
    });
  }, [activeRows, search, categoryFilter]);

  const unclassifiedCount = competitions.filter(
    competition => competition.type === 'SOLO' && !competition.performanceMode
  ).length;
  const totalEventEntries = activeRows.reduce((sum, row) => sum + row.competitionsCount, 0);
  const highestTotal = activeRows[0]?.totalMarks;
  const activeTitle = activeMode === 'STAGE' ? 'Star of the Fest' : 'Pen of the Fest';

  const handleRetrySync = () => window.location.reload();

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-5 pb-8 sm:space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#E5EAF1] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                <Trophy className="h-3.5 w-3.5" /> Festival awards
              </span>
              <span className="text-[11px] font-medium text-[#64748B]">Admin workspace</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">Top Scorers</h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#64748B] sm:text-sm">
              Official individual rankings for Star of the Fest and Pen of the Fest, calculated from published results.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {topScorersSyncState === 'ready' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Live data synced
              </span>
            )}
            {topScorersSyncState === 'loading' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Syncing live data
              </span>
            )}
            {topScorersSyncState === 'error' && (
              <button
                type="button"
                onClick={handleRetrySync}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry sync
              </button>
            )}
            {topScorersSyncState === 'idle' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" /> Waiting for admin session
              </span>
            )}
          </div>
        </header>

        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 sm:p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <p className="text-[11px] leading-5 text-blue-950 sm:text-xs">
            Each published individual event is normalized to 100 marks and added to the participant&apos;s total.
            Group results are excluded from individual awards and count only toward the Team Championship.
            Unpublished results are excluded, and equal totals share the same position.
          </p>
        </div>

        {unclassifiedCount > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-xs leading-5 text-amber-950">
                <strong>{unclassifiedCount} individual competition(s)</strong> are not classified as Stage or Off Stage.
                They cannot contribute to either award until classified.
              </p>
            </div>
            <Link
              href="/admin/competitions"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Review competitions
            </Link>
          </div>
        )}

        {topScorersSyncState !== 'ready' ? (
          <section className="rounded-2xl border border-[#E5EAF1] bg-white p-6 shadow-sm sm:p-8">
            {topScorersSyncState === 'loading' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />
                <h2 className="mt-4 text-sm font-bold text-[#1F2937]">Synchronizing ranking data</h2>
                <p className="mt-1 max-w-md text-xs leading-5 text-[#64748B]">
                  Waiting for the live results, competitions, registrations and participant records.
                </p>
              </div>
            ) : topScorersSyncState === 'error' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-sm font-bold text-[#1F2937]">Ranking data could not be synchronized</h2>
                <p className="mt-1 max-w-md text-xs leading-5 text-[#64748B]">
                  One or more required Firestore feeds failed. Rankings are hidden to avoid showing incomplete totals.
                </p>
                <button
                  type="button"
                  onClick={handleRetrySync}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                >
                  <RefreshCw className="h-4 w-4" /> Retry synchronization
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-7 w-7 text-amber-600" />
                <h2 className="mt-3 text-sm font-bold text-[#1F2937]">Administrator access required</h2>
                <p className="mt-1 max-w-md text-xs leading-5 text-[#64748B]">
                  Sign in with an active administrator account to view the complete individual rankings.
                </p>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Stage ranked participants</span>
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Mic2 className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-[#111827]">{stageRows.length}</p>
                <p className="mt-1 text-[10px] text-[#94A3B8]">Star of the Fest</p>
              </div>
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Off-stage ranked participants</span>
                  <span className="rounded-lg bg-violet-50 p-2 text-violet-700"><BookOpen className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-[#111827]">{offStageRows.length}</p>
                <p className="mt-1 text-[10px] text-[#94A3B8]">Pen of the Fest</p>
              </div>
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Unclassified individual events</span>
                  <span className="rounded-lg bg-amber-50 p-2 text-amber-700"><Filter className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-[#111827]">{unclassifiedCount}</p>
                <p className="mt-1 text-[10px] text-[#94A3B8]">Require Stage / Off Stage classification</p>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-[#111827]">Award overview</h2>
                  <p className="mt-1 text-xs text-[#64748B]">Select an award to open its full participant ranking.</p>
                </div>
                <span className="text-[10px] font-medium text-[#94A3B8]">Updates automatically when results are published</span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <AwardOverviewCard
                  title="Star of the Fest"
                  subtitle="Stage competitions"
                  mode="STAGE"
                  rows={stageRows}
                  active={activeMode === 'STAGE'}
                  onSelect={setActiveMode}
                />
                <AwardOverviewCard
                  title="Pen of the Fest"
                  subtitle="Off-stage competitions"
                  mode="OFF_STAGE"
                  rows={offStageRows}
                  active={activeMode === 'OFF_STAGE'}
                  onSelect={setActiveMode}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#E5EAF1] bg-white shadow-sm">
              <div className="border-b border-[#E8EDF3] p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={[
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                        activeMode === 'STAGE' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                      ].join(' ')}>
                        {activeMode === 'STAGE' ? <Mic2 className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                        {activeMode === 'STAGE' ? 'Stage award' : 'Off-stage award'}
                      </span>
                      <span className="text-[10px] font-medium text-[#94A3B8]">{activeRows.length} ranked participants</span>
                    </div>
                    <h2 className="mt-2 text-base font-extrabold text-[#111827]">{activeTitle} — Rankings</h2>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {totalEventEntries} published individual event entries included
                      {highestTotal !== undefined ? ' · Leading total ' + highestTotal.toFixed(2) : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                    <label className="relative block min-w-0">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        type="search"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search name, bib or team"
                        aria-label="Search ranked participants"
                        className="h-10 w-full rounded-lg border border-[#DCE3EC] bg-white pl-9 pr-3 text-xs text-[#1F2937] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="relative block min-w-0">
                      <span className="sr-only">Filter by category</span>
                      <select
                        value={categoryFilter}
                        onChange={event => setCategoryFilter(event.target.value)}
                        className="h-10 w-full appearance-none rounded-lg border border-[#DCE3EC] bg-white px-3 pr-9 text-xs font-medium text-[#334155] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="ALL">All categories</option>
                        {categories.map(category => <option key={category} value={category}>{category}</option>)}
                      </select>
                      <Filter className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMode('STAGE')}
                    aria-pressed={activeMode === 'STAGE'}
                    className={[
                      'inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors',
                      activeMode === 'STAGE' ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-[#DCE3EC] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                    ].join(' ')}
                  >
                    <Mic2 className="h-3.5 w-3.5" /> Star of the Fest <span className={activeMode === 'STAGE' ? 'text-blue-100' : 'text-[#94A3B8]'}>{stageRows.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('OFF_STAGE')}
                    aria-pressed={activeMode === 'OFF_STAGE'}
                    className={[
                      'inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors',
                      activeMode === 'OFF_STAGE' ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-[#DCE3EC] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                    ].join(' ')}
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Pen of the Fest <span className={activeMode === 'OFF_STAGE' ? 'text-violet-100' : 'text-[#94A3B8]'}>{offStageRows.length}</span>
                  </button>
                </div>
              </div>

              {filteredRows.length ? (
                <ScorerTable rows={filteredRows} />
              ) : (
                <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#64748B]">
                    {activeRows.length ? <Search className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-[#1F2937]">
                    {activeRows.length ? 'No participants match these filters' : 'No eligible published results yet'}
                  </h3>
                  <p className="mt-1 max-w-md text-xs leading-5 text-[#64748B]">
                    {activeRows.length
                      ? 'Try another search term or reset the category filter.'
                      : 'Classify individual competitions as Stage or Off Stage, approve registrations and publish their results to populate this ranking.'}
                  </p>
                  {activeRows.length > 0 && (search || categoryFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => { setSearch(''); setCategoryFilter('ALL'); }}
                      className="mt-3 rounded-lg border border-[#DCE3EC] px-3 py-2 text-xs font-bold text-[#475569] hover:bg-[#F8FAFC]"
                    >
                      Clear filters
                    </button>
                  )}
                  {!activeRows.length && (
                    <Link href="/admin/competitions" className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
                      Review competitions
                    </Link>
                  )}
                </div>
              )}

              <footer className="flex flex-col gap-1 border-t border-[#E8EDF3] bg-[#FAFBFD] px-4 py-3 text-[10px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Official individual award register</span>
                <span>{filteredRows.length} of {activeRows.length} participants shown</span>
              </footer>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
