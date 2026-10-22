'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TabulationPrintSheet } from '@/components/domain/TabulationPrintSheet';
import {
  FileDown,
  Printer,
  FileSpreadsheet,
  FileText,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  Trophy,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { ExportService } from '@/services/exportService';

export default function ExportManagementPage() {
  const { results, theme, categories } = useFest();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'WINNERS' | 'SCORE_REGISTER'>('WINNERS');
  const [printWinnersOpen, setPrintWinnersOpen] = useState(false);
  const [printScoreRegisterOpen, setPrintScoreRegisterOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // CRITICAL RULE: Filter ONLY published results as official winners!
  const publishedResults = results.filter(r => r.resultStatus === 'PUBLISHED');

  const filteredResults = publishedResults.filter(r => {
    const matchesSearch = r.competitionName.toLowerCase().includes(search.toLowerCase()) ||
                          r.competitionCode.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || r.categoryName === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const [selectedIds, setSelectedIds] = useState<string[]>(publishedResults.map(r => r.id));

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredResults.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredResults.map(r => r.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const selectedResults = publishedResults.filter(r => selectedIds.includes(r.id));

  // Export 1: Primary Official Published Winners CSV
  const handleExportWinnersCSV = () => {
    if (selectedResults.length === 0) {
      alert('Please select at least one published competition to export.');
      return;
    }
    const rows = ExportService.getOfficialPublishedWinners(selectedResults);
    const filename = `${theme.festivalName.replace(/\s+/g, '_')}_Official_Published_Winners.csv`;
    ExportService.downloadWinnersCSV(rows, filename);

    setExportNotice('Official Published Winners CSV (.csv) generated and downloaded successfully.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Export 2: Official Published Winners OpenXML XLSX Format (.xlsx)
  const handleExportWinnersExcel = () => {
    if (selectedResults.length === 0) {
      alert('Please select at least one published competition to export.');
      return;
    }
    const rows = ExportService.getOfficialPublishedWinners(selectedResults);
    const filename = `${theme.festivalName.replace(/\s+/g, '_')}_Official_Published_Winners.xlsx`;
    ExportService.downloadWinnersXLSX(rows, filename);

    setExportNotice('Official Published Winners OpenXML Workbook (.xlsx) generated and downloaded successfully.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Export 3: Official Published Winners Downloadable PDF (.pdf)
  const handleDownloadWinnersPDF = () => {
    if (selectedResults.length === 0) {
      alert('Please select at least one published competition to export.');
      return;
    }
    const rows = ExportService.getOfficialPublishedWinners(selectedResults);
    const filename = `${theme.festivalName.replace(/\s+/g, '_')}_Official_Published_Winners.pdf`;
    ExportService.downloadWinnersPDF(rows, theme.festivalName, theme.institutionName, filename);

    setExportNotice('Official Published Winners Tabulation PDF (.pdf) generated and downloaded successfully.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Export 4: Browser Print Sheet
  const handlePrintWinnersSheet = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Export Management &amp; Official Tabulation
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Official export center: Export verified published winners in real XLSX, PDF, and CSV formats.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Printer className="w-4 h-4 text-[#526070]" />}
              onClick={handlePrintWinnersSheet}
            >
              Print View
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText className="w-4 h-4 text-red-600" />}
              onClick={handleDownloadWinnersPDF}
            >
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
              onClick={handleExportWinnersExcel}
            >
              Export XLSX
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileDown className="w-4 h-4" />}
              onClick={handleExportWinnersCSV}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Notice Banner */}
        {exportNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Strict Scope Alert */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>
              <strong>Official Published Winners Focus:</strong> Only verified, admin-published results appear here. Unpublished drafts are excluded to protect institutional tabulation integrity.
            </span>
          </div>
          <span className="font-bold text-[#2563EB]">{publishedResults.length} Events Published</span>
        </div>

        {/* Primary / Optional Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E1E7EF]">
          <button
            onClick={() => setActiveTab('WINNERS')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'WINNERS'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#526070] hover:text-[#111111]'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Official Published Winners (Primary)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-[#2563EB]">
              {publishedResults.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('SCORE_REGISTER')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'SCORE_REGISTER'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#526070] hover:text-[#111111]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Full Score Register / Tabulation Register</span>
          </button>
        </div>

        {activeTab === 'WINNERS' ? (
          <>
            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl border border-[#E1E7EF] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter published competitions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  aria-label="Filter by Category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none focus:bg-white"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Published Winners Table */}
            <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E1E7EF] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-xs text-[#526070] hover:text-[#111111] font-semibold flex items-center gap-1.5"
                  >
                    {selectedIds.length === filteredResults.length && filteredResults.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#526070]" />
                    )}
                    <span>Select All ({selectedResults.length} selected)</span>
                  </button>
                </div>
                <span className="text-xs text-[#526070]">
                  Official Published Results Register
                </span>
              </div>

              {filteredResults.length === 0 ? (
                <div className="p-12 text-center">
                  <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-[#111111]">No Published Results Available for Export</h4>
                  <p className="text-xs text-[#526070] mt-1 max-w-md mx-auto">
                    Only competitions that have been evaluated and officially published by an Admin appear here. Visit the Results page to publish reviewed marks.
                  </p>
                  <div className="mt-4">
                    <Link href="/admin/results">
                      <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                        Go to Results Management
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                        <th className="py-3 px-4 w-10"></th>
                        <th className="py-3 px-4">Competition &amp; Category</th>
                        <th className="py-3 px-4">🥇 1st Prize Winner</th>
                        <th className="py-3 px-4">🥈 2nd Prize Winner</th>
                        <th className="py-3 px-4">🥉 3rd Prize Winner</th>
                        <th className="py-3 px-4 text-right">Event Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E7EF]">
                      {filteredResults.map((res) => {
                        const isSelected = selectedIds.includes(res.id);
                        const r1 = res.ranks.find(r => r.rank === 1);
                        const r2 = res.ranks.find(r => r.rank === 2);
                        const r3 = res.ranks.find(r => r.rank === 3);

                        const r1Pts = r1 ? (r1.officialPoints ?? r1.totalEarnedPoints) : 0;
                        const r2Pts = r2 ? (r2.officialPoints ?? r2.totalEarnedPoints) : 0;
                        const r3Pts = r3 ? (r3.officialPoints ?? r3.totalEarnedPoints) : 0;
                        const eventTotal = r1Pts + r2Pts + r3Pts;

                        return (
                          <tr key={res.id} className={`hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                            <td className="py-4 px-4">
                              <button onClick={() => handleToggleSelectOne(res.id)} aria-label="Select competition">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                                ) : (
                                  <Square className="w-4 h-4 text-[#526070]" />
                                )}
                              </button>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                  {res.competitionCode}
                                </span>
                                <div>
                                  <span className="font-bold text-[#111111] text-sm block">{res.competitionName}</span>
                                  <span className="text-[11px] text-[#526070]">
                                    {res.categoryName} · {res.type}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              {r1 ? (
                                <div>
                                  <span className="font-bold text-[#111111] block">{r1.candidateName}</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#526070] mt-0.5">
                                    <span className="font-semibold text-[#111111]">{r1.teamCode}</span>
                                    <span>·</span>
                                    <span className="font-bold text-[#2563EB]">Grade {r1.grade}</span>
                                    <span>·</span>
                                    <span className="text-emerald-600 font-extrabold">+{r1Pts} pts</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-400 italic">None</span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              {r2 ? (
                                <div>
                                  <span className="font-bold text-[#111111] block">{r2.candidateName}</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#526070] mt-0.5">
                                    <span className="font-semibold text-[#111111]">{r2.teamCode}</span>
                                    <span>·</span>
                                    <span className="font-bold text-[#2563EB]">Grade {r2.grade}</span>
                                    <span>·</span>
                                    <span className="text-emerald-600 font-extrabold">+{r2Pts} pts</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-400 italic">None</span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              {r3 ? (
                                <div>
                                  <span className="font-bold text-[#111111] block">{r3.candidateName}</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#526070] mt-0.5">
                                    <span className="font-semibold text-[#111111]">{r3.teamCode}</span>
                                    <span>·</span>
                                    <span className="font-bold text-[#2563EB]">Grade {r3.grade}</span>
                                    <span>·</span>
                                    <span className="text-emerald-600 font-extrabold">+{r3Pts} pts</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-400 italic">None</span>
                              )}
                            </td>

                            <td className="py-4 px-4 text-right">
                              <span className="font-extrabold text-sm text-[#111111]">
                                {eventTotal} pts
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Optional Tab: Full Score Register */
          <div className="bg-white p-6 rounded-xl border border-[#E1E7EF] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">Comprehensive Tabulation Register</h3>
                <p className="text-xs text-[#526070] mt-0.5">
                  Print the master jury score sheets with criterion sub-totals, judges signature lines, and chief controller sign-off.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => setPrintScoreRegisterOpen(true)}
              >
                Open Printable Tabulation Register
              </Button>
            </div>

            <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E1E7EF] text-xs text-[#526070]">
              Available for formal institutional accreditation records. Contains all candidate rows, criteria score matrices, and signatures.
            </div>
          </div>
        )}

        {/* Tabulation Print Sheet Modal */}
        <TabulationPrintSheet
          isOpen={printScoreRegisterOpen}
          onClose={() => setPrintScoreRegisterOpen(false)}
          results={publishedResults}
        />
      </div>
    </AdminLayout>
  );
}
