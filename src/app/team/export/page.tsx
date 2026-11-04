'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { TeamSyncStatus } from '@/components/domain/TeamSyncStatus';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { TeamExportService, type TeamResultExportRow } from '@/services/teamExportService';
import { Award, Download, FileDown, FileSpreadsheet, FileText, Printer, Search, Trophy } from 'lucide-react';

type TeamExportRow = TeamResultExportRow & { id: string };

export default function TeamExportPage() {
  const { currentTeamUser, teams, results, resultsSyncState, theme } = useFest();
  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // Only officially published results and ranks belonging to the signed-in team are exportable.
  const teamRows: TeamExportRow[] = team
    ? results
        .filter(result => result.resultStatus === 'PUBLISHED')
        .flatMap(result =>
          result.ranks
            .filter(rank => rank.teamId === team.id)
            .map(rank => ({
              id: result.id + '-' + rank.registrationId,
              competitionCode: result.competitionCode,
              competitionName: result.competitionName,
              categoryName: result.categoryName || 'General',
              type: result.type || 'SOLO',
              stageName: result.stageName || '—',
              candidateName: rank.candidateName,
              bib: rank.bib || '—',
              grade: rank.grade || '—',
              rank: rank.rank,
              publishedDate: result.publishedDate || '—'
            }))
        )
        .sort((a, b) =>
          a.competitionName.localeCompare(b.competitionName) ||
          (a.rank ?? 99) - (b.rank ?? 99) ||
          a.candidateName.localeCompare(b.candidateName)
        )
    : [];

  const categories = Array.from(new Set(teamRows.map(row => row.categoryName))).sort();
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = teamRows.filter(row => {
    const matchesSearch = !normalizedSearch ||
      row.competitionName.toLowerCase().includes(normalizedSearch) ||
      row.competitionCode.toLowerCase().includes(normalizedSearch) ||
      row.candidateName.toLowerCase().includes(normalizedSearch) ||
      row.bib.toLowerCase().includes(normalizedSearch);
    return matchesSearch && (categoryFilter === 'ALL' || row.categoryName === categoryFilter);
  });

  const firstPlaces = filteredRows.filter(row => row.rank === 1).length;
  const secondPlaces = filteredRows.filter(row => row.rank === 2).length;
  const thirdPlaces = filteredRows.filter(row => row.rank === 3).length;
  const disabled = filteredRows.length === 0;

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(''), 4500);
  };

  const handleCSV = () => {
    if (disabled || !team) return;
    TeamExportService.downloadCSV(filteredRows, (team.code || team.name) + '_Team_Results.csv');
    showNotice('Your team results CSV has been downloaded.');
  };

  const handleXLSX = () => {
    if (disabled || !team) return;
    TeamExportService.downloadXLSX(
      filteredRows, team.name, team.code, theme.festivalName,
      (team.code || team.name) + '_Team_Results.xlsx'
    );
    showNotice('Your team results Excel workbook has been downloaded.');
  };

  const handlePDF = () => {
    if (disabled || !team) return;
    TeamExportService.downloadPDF(
      filteredRows, team.name, team.code, theme.festivalName, theme.institutionName,
      (team.code || team.name) + '_Team_Results_A4.pdf'
    );
    showNotice('Your team results A4 PDF has been downloaded.');
  };

  const handlePrint = () => {
    if (disabled) return;
    document.body.classList.add('print-team-export');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('print-team-export');
    }, { once: true });
    window.print();
  };

  const rankLabel = (rank: TeamExportRow['rank']) => {
    if (rank === 1) return '1st Place';
    if (rank === 2) return '2nd Place';
    if (rank === 3) return '3rd Place';
    return 'Grade only';
  };

  const rankTone = (rank: TeamExportRow['rank']) => {
    if (rank === 1) return 'border-amber-200 bg-amber-50 text-amber-800';
    if (rank === 2) return 'border-slate-200 bg-slate-100 text-slate-700';
    if (rank === 3) return 'border-orange-200 bg-orange-50 text-orange-800';
    return 'border-blue-100 bg-blue-50 text-blue-700';
  };

  return (
    <TeamLayout>
      <div className="team-export-page space-y-5 sm:space-y-6">
        <header className="team-export-screen-header flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              <FileDown className="h-4 w-4" />
              Team Manager · Reports
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Export Team Results</h1>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              Download official published grades and prize positions for {team?.name || 'your team'}.
            </p>
          </div>
          <div className="team-export-actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button variant="outline" size="md" className="w-full !rounded-xl sm:w-auto" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrint} disabled={disabled}>Print view</Button>
            <Button variant="outline" size="md" className="w-full !rounded-xl sm:w-auto" leftIcon={<FileText className="h-4 w-4 text-red-600" />} onClick={handlePDF} disabled={disabled}>Download PDF</Button>
            <Button variant="outline" size="md" className="w-full !rounded-xl sm:w-auto" leftIcon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} onClick={handleXLSX} disabled={disabled}>Export XLSX</Button>
            <Button variant="primary" size="md" className="w-full !rounded-xl sm:w-auto" leftIcon={<Download className="h-4 w-4" />} onClick={handleCSV} disabled={disabled}>Export CSV</Button>
          </div>
        </header>

        <div className="team-export-sync-status">
          <TeamSyncStatus sources={['teams', 'results']} />
        </div>

        {notice && (
          <div role="status" className="team-export-notice flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            <Award className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="team-export-notice flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-2.5 text-xs leading-5 text-blue-950">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <span>
              This report includes only officially published entries belonging to <strong>{team?.name} ({team?.code})</strong>. Other teams’ participant information is excluded.
            </span>
          </div>
          <span className="shrink-0 self-start rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-800 sm:self-center">
            {teamRows.length} published entries
          </span>
        </div>

        <section className="team-export-metrics grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricCard label="Entries in view" value={filteredRows.length} detail="Published placements" tone="blue" />
          <MetricCard label="1st places" value={firstPlaces} detail="First prize awards" tone="amber" />
          <MetricCard label="2nd places" value={secondPlaces} detail="Second prize awards" tone="slate" />
          <MetricCard label="3rd places" value={thirdPlaces} detail="Third prize awards" tone="orange" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="team-export-filters flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Published team results</h2>
              <p className="mt-1 text-xs text-slate-500">Export actions use the entries currently shown below.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search team results"
                  placeholder="Search event, contestant or Bib…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                aria-label="Filter results by category"
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-48"
              >
                <option value="ALL">All categories</option>
                {categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </div>

          <div className="team-export-print-heading">
            <div className="print-kicker">OFFICIAL FESTIVAL RESULTS</div>
            <h1>{theme.festivalName}</h1>
            <p>{theme.institutionName}</p>
            <div className="print-team-meta">
              <strong>{team?.name} ({team?.code}) — Team Results Register</strong>
              <span>Generated {new Date().toLocaleDateString('en-GB')}</span>
              <span>{filteredRows.length} entries</span>
            </div>
          </div>

          {resultsSyncState === 'loading' && teamRows.length === 0 ? (
            <div className="team-export-empty p-10 text-center text-sm text-slate-500">Loading published team results…</div>
          ) : resultsSyncState === 'error' ? (
            <div className="team-export-empty p-10 text-center text-sm text-amber-800">Published results could not be synchronized. Please refresh after your connection is restored.</div>
          ) : filteredRows.length === 0 ? (
            <div className="team-export-empty px-5 py-12 text-center">
              <Trophy className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {teamRows.length === 0 ? 'No published team results yet' : 'No results match these filters'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                {teamRows.length === 0
                  ? 'Once results for your team are officially published, you can download the report as PDF, Excel or CSV.'
                  : 'Try another search term or select a different category.'}
              </p>
            </div>
          ) : (
            <>
              <div className="team-export-mobile space-y-3 p-3 md:hidden">
                {filteredRows.map(row => (
                  <article key={row.id} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-950">{row.competitionName}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.competitionCode} · {row.categoryName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${rankTone(row.rank)}`}>{rankLabel(row.rank)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-slate-800">{row.candidateName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.bib} · {row.type === 'SOLO' ? 'Individual' : 'Group'}</p>
                      </div>
                      <span className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">Grade {row.grade}</span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="team-export-table-wrap hidden overflow-x-auto md:block">
                <table className="team-export-table min-w-[860px] w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3.5">Code</th>
                      <th className="px-4 py-3.5">Competition</th>
                      <th className="px-4 py-3.5">Contestant / group</th>
                      <th className="px-4 py-3.5">Bib</th>
                      <th className="px-4 py-3.5">Category / type</th>
                      <th className="px-4 py-3.5">Stage</th>
                      <th className="px-4 py-3.5 text-center">Rank</th>
                      <th className="px-4 py-3.5 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map(row => (
                      <tr key={row.id} className="transition hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-700">{row.competitionCode}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">{row.competitionName}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-800">{row.candidateName}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">{row.bib}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">{row.categoryName} · {row.type === 'SOLO' ? 'Individual' : 'Group'}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">{row.stageName}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${rankTone(row.rank)}`}>{rankLabel(row.rank)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-sm font-bold text-blue-800">{row.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        .team-export-print-heading { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body.print-team-export, body.print-team-export * { visibility: hidden !important; }
          body.print-team-export .team-export-page,
          body.print-team-export .team-export-page * { visibility: visible !important; }
          body.print-team-export .team-export-page { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; color: #111827 !important; background: #fff !important; font: 7pt Arial, Helvetica, sans-serif !important; }
          body.print-team-export .team-export-screen-header,
          body.print-team-export .team-export-actions,
          body.print-team-export .team-export-notice,
          body.print-team-export .team-export-sync-status,
          body.print-team-export .team-export-metrics,
          body.print-team-export .team-export-filters,
          body.print-team-export .team-export-empty,
          body.print-team-export .team-export-mobile { display: none !important; }
          body.print-team-export .team-export-table-wrap { display: block !important; overflow: visible !important; }
          body.print-team-export .team-export-print-heading { display: block !important; padding-bottom: 8px; border-bottom: 2px solid #2563eb; margin-bottom: 9px; }
          body.print-team-export .team-export-print-heading .print-kicker { color: #2563eb; font-size: 7pt; font-weight: 800; letter-spacing: 1px; }
          body.print-team-export .team-export-print-heading h1 { margin: 3px 0 1px; font-size: 16pt; line-height: 1.1; font-weight: 800; text-transform: uppercase; }
          body.print-team-export .team-export-print-heading p { margin: 0; color: #475569; font-size: 8pt; }
          body.print-team-export .print-team-meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 7px; font-size: 7pt; }
          body.print-team-export .team-export-table { display: table !important; width: 100%; border-collapse: collapse; table-layout: fixed; }
          body.print-team-export .team-export-table thead { display: table-header-group; }
          body.print-team-export .team-export-table tr { break-inside: avoid; page-break-inside: avoid; }
          body.print-team-export .team-export-table th { background: #e2e8f0 !important; color: #334155 !important; font-size: 6pt; text-transform: uppercase; }
          body.print-team-export .team-export-table th, body.print-team-export .team-export-table td { border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; overflow-wrap: anywhere; }
          body.print-team-export .team-export-table td { font-size: 6.5pt; line-height: 1.15; }
          body.print-team-export .team-export-table tbody tr:nth-child(even) { background: #f8fafc !important; }
        }
      `}</style>
    </TeamLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'blue' | 'amber' | 'slate' | 'orange';
}) {
  const valueTone = {
    blue: 'text-blue-800',
    amber: 'text-amber-700',
    slate: 'text-slate-800',
    orange: 'text-orange-800'
  }[tone];

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{detail}</p>
    </article>
  );
}
