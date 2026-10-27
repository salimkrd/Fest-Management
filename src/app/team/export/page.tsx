
'use client';

import React, { useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { TeamExportService, type TeamResultExportRow } from '@/services/teamExportService';
import { Award, Download, FileDown, FileSpreadsheet, FileText, Printer, Search, Trophy } from 'lucide-react';

type TeamExportRow = TeamResultExportRow & { id: string };

export default function TeamExportPage() {
  const { currentTeamUser, teams, results, theme } = useFest();
  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [notice, setNotice] = useState('');

  // Only published results that belong to the authenticated team are exportable.
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
              stageName: result.stageName || '-',
              candidateName: rank.candidateName,
              bib: rank.bib || '-',
              score: rank.score,
              grade: rank.grade || '-',
              rank: rank.rank,
              points: rank.officialPoints ?? rank.totalEarnedPoints ?? 0,
              publishedDate: result.publishedDate || '-'
            }))
        )
        .sort((a, b) =>
          a.competitionName.localeCompare(b.competitionName) ||
          (a.rank ?? 99) - (b.rank ?? 99) ||
          a.candidateName.localeCompare(b.candidateName)
        )
    : [];

  const categories = Array.from(new Set(teamRows.map(row => row.categoryName))).sort();
  const filteredRows = teamRows.filter(row => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query ||
      row.competitionName.toLowerCase().includes(query) ||
      row.competitionCode.toLowerCase().includes(query) ||
      row.candidateName.toLowerCase().includes(query) ||
      row.bib.toLowerCase().includes(query);
    return matchesSearch && (categoryFilter === 'ALL' || row.categoryName === categoryFilter);
  });

  const totalPoints = filteredRows.reduce((sum, row) => sum + row.points, 0);
  const firstPlaces = filteredRows.filter(row => row.rank === 1).length;
  const secondPlaces = filteredRows.filter(row => row.rank === 2).length;
  const thirdPlaces = filteredRows.filter(row => row.rank === 3).length;
  const disabled = filteredRows.length === 0;

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
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
    return 'Grade-only / No Prize';
  };

  return (
    <TeamLayout>
      <div className="team-export-page space-y-6">
        <div className="team-export-screen-header flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#E1E7EF]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2563EB]">
              <FileDown className="w-4 h-4" /> Team Manager Portal
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight mt-1">Export My Team Results</h1>
            <p className="text-xs text-[#526070] mt-1">Download the published results and points awarded to {team?.name || 'your team'} only.</p>
          </div>
          <div className="team-export-actions flex flex-wrap gap-2">
            <Button variant="outline" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint} disabled={disabled}>Print View</Button>
            <Button variant="outline" size="sm" leftIcon={<FileText className="w-4 h-4 text-red-600" />} onClick={handlePDF} disabled={disabled}>Download PDF</Button>
            <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />} onClick={handleXLSX} disabled={disabled}>Export XLSX</Button>
            <Button variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleCSV} disabled={disabled}>Export CSV</Button>
          </div>
        </div>

        {notice && (
          <div className="team-export-notice flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            <Award className="w-4 h-4 shrink-0" /><span>{notice}</span>
          </div>
        )}

        <div className="team-export-notice rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2 text-xs text-blue-950">
            <Trophy className="w-4 h-4 mt-0.5 shrink-0 text-blue-700" />
            <span>This export contains only officially published results belonging to <strong>{team?.name} ({team?.code})</strong>. Other teams’ contestant names and results are not included.</span>
          </div>
          <span className="shrink-0 rounded-full bg-white border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-800">{teamRows.length} published entries</span>
        </div>

        <div className="team-export-metrics grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E1E7EF] rounded-xl p-4"><span className="text-[11px] font-bold uppercase tracking-wide text-[#526070]">Entries in View</span><strong className="block text-2xl text-[#111111] mt-1">{filteredRows.length}</strong><span className="text-[10px] text-[#526070]">Published placements</span></div>
          <div className="bg-white border border-[#E1E7EF] rounded-xl p-4"><span className="text-[11px] font-bold uppercase tracking-wide text-[#526070]">Points in Export</span><strong className="block text-2xl text-[#2563EB] mt-1">{totalPoints}</strong><span className="text-[10px] text-[#526070]">Official team points</span></div>
          <div className="bg-white border border-[#E1E7EF] rounded-xl p-4"><span className="text-[11px] font-bold uppercase tracking-wide text-[#526070]">First Places</span><strong className="block text-2xl text-amber-600 mt-1">{firstPlaces}</strong><span className="text-[10px] text-[#526070]">1st prize awards</span></div>
          <div className="bg-white border border-[#E1E7EF] rounded-xl p-4"><span className="text-[11px] font-bold uppercase tracking-wide text-[#526070]">Other Podium Places</span><strong className="block text-2xl text-[#111111] mt-1">{secondPlaces + thirdPlaces}</strong><span className="text-[10px] text-[#526070]">2nd: {secondPlaces} · 3rd: {thirdPlaces}</span></div>
        </div>

        <div className="bg-white rounded-xl border border-[#E1E7EF] overflow-hidden shadow-xs">
          <div className="team-export-filters p-4 border-b border-[#E1E7EF] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold text-[#111111]">Published Team Results</h2><p className="text-[11px] text-[#526070] mt-0.5">Export actions use the results currently shown below.</p></div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="text" aria-label="Search my team results" placeholder="Search event, contestant, bib..." value={search} onChange={event => setSearch(event.target.value)} className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] focus:outline-none focus:border-[#2563EB]" />
              </div>
              <select aria-label="Filter by category" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#E1E7EF] bg-white">
                <option value="ALL">All Categories</option>
                {categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </div>

          <div className="team-export-print-heading">
            <div className="print-kicker">OFFICIAL FESTIVAL RESULTS</div>
            <h1>{theme.festivalName}</h1>
            <p>{theme.institutionName}</p>
            <div className="print-team-meta"><strong>{team?.name} ({team?.code}) — Team Results Register</strong><span>Generated {new Date().toLocaleDateString('en-GB')}</span><span>{filteredRows.length} entries · {totalPoints} points</span></div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="team-export-empty p-12 text-center">
              <Trophy className="w-9 h-9 text-[#94A3B8] mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[#111111]">{teamRows.length === 0 ? 'No Published Team Results Yet' : 'No Results Match These Filters'}</h3>
              <p className="text-xs text-[#526070] mt-1 max-w-md mx-auto">{teamRows.length === 0 ? 'Once your team results are officially published, you can download them here as PDF, Excel, or CSV.' : 'Try changing the search term or category filter.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="team-export-table w-full text-left text-xs">
                <thead><tr className="bg-[#F8FAFC] border-b border-[#E1E7EF] text-[10px] uppercase tracking-wide text-[#526070]">
                  <th className="py-3 px-4">Code</th><th className="py-3 px-4">Competition</th><th className="py-3 px-4">Contestant / Group</th><th className="py-3 px-4">Bib</th><th className="py-3 px-4">Category / Type</th><th className="py-3 px-4">Stage</th><th className="py-3 px-4 text-center">Rank</th><th className="py-3 px-4 text-center">Score</th><th className="py-3 px-4 text-center">Grade</th><th className="py-3 px-4 text-right">Points</th>
                </tr></thead>
                <tbody className="divide-y divide-[#E1E7EF]">
                  {filteredRows.map(row => (
                    <tr key={row.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-bold text-[#2563EB]">{row.competitionCode}</td>
                      <td className="py-3 px-4 font-bold text-[#111111]">{row.competitionName}</td>
                      <td className="py-3 px-4 font-semibold text-[#111111]">{row.candidateName}</td>
                      <td className="py-3 px-4">{row.bib}</td><td className="py-3 px-4">{row.categoryName} / {row.type}</td><td className="py-3 px-4 text-[#526070]">{row.stageName}</td>
                      <td className="py-3 px-4 text-center font-semibold">{rankLabel(row.rank)}</td><td className="py-3 px-4 text-center font-bold">{row.score}</td><td className="py-3 px-4 text-center font-bold text-[#2563EB]">{row.grade}</td><td className="py-3 px-4 text-right font-extrabold text-emerald-700">{row.points} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
          body.print-team-export .team-export-metrics,
          body.print-team-export .team-export-filters,
          body.print-team-export .team-export-empty { display: none !important; }
          body.print-team-export .team-export-print-heading { display: block !important; padding-bottom: 8px; border-bottom: 2px solid #2563eb; margin-bottom: 9px; }
          body.print-team-export .team-export-print-heading .print-kicker { color: #2563eb; font-size: 7pt; font-weight: 800; letter-spacing: 1px; }
          body.print-team-export .team-export-print-heading h1 { margin: 3px 0 1px; font-size: 16pt; line-height: 1.1; font-weight: 800; text-transform: uppercase; }
          body.print-team-export .team-export-print-heading p { margin: 0; color: #475569; font-size: 8pt; }
          body.print-team-export .print-team-meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 7px; font-size: 7pt; }
          body.print-team-export .team-export-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
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
