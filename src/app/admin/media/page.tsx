'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useFest } from '@/context/FestContext';
import { CompetitionResult } from '@/types/fest';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PosterStudioModal } from '@/components/domain/PosterStudioModal';
import { ThemeCustomizerModal } from '@/components/domain/ThemeCustomizerModal';
import { Sparkles, Palette, Image as ImageIcon, Search, Download, Globe, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function MediaManagementPage() {
  const { results, theme } = useFest();

  const [search, setSearch] = useState('');
  const [selectedResult, setSelectedResult] = useState<CompetitionResult | null>(results[0] || null);
  const [posterStudioOpen, setPosterStudioOpen] = useState(false);
  const [themeCustomizerOpen, setThemeCustomizerOpen] = useState(false);

  // Only published results can have released result posters (per DESIGN v2.0)
  const publishedResults = results.filter(r => r.resultStatus === 'PUBLISHED');

  const filtered = publishedResults.filter(r =>
    r.competitionName.toLowerCase().includes(search.toLowerCase()) ||
    r.competitionCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenStudio = (res: CompetitionResult) => {
    setSelectedResult(res);
    setPosterStudioOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              Media Management &amp; Poster Studio
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Design and release official result celebration graphics, laureate announcements, and public theme styles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Palette className="w-4 h-4 text-[#2563EB]" />}
              onClick={() => setThemeCustomizerOpen(true)}
            >
              Configure Public Theme
            </Button>
          </div>
        </div>

        {/* Public Theme Snapshot Card */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {theme.festivalName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#111111]">{theme.festivalName} Active Theme</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2563EB]">
                  {theme.fontFamily}
                </span>
              </div>
              <p className="text-xs text-[#526070] mt-0.5">
                Primary Brand: <span className="font-mono font-semibold text-[#111111]">{theme.primaryColor}</span> · Background: <span className="font-semibold text-[#111111]">{theme.backgroundStyle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Palette className="w-4 h-4" />}
              onClick={() => setThemeCustomizerOpen(true)}
            >
              Customize Palette &amp; Fonts
            </Button>
            <Link href="/public" target="_blank">
              <Button variant="outline" size="sm" leftIcon={<Globe className="w-4 h-4" />}>
                Preview
              </Button>
            </Link>
          </div>
        </div>

        {/* Poster Studio Candidates Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E1E7EF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search published competition..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
              />
            </div>
            <span className="text-xs text-[#526070] font-medium">
              {publishedResults.length} Verified Events Ready for Media
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Competition ID &amp; Name</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">First Place Champion</th>
                  <th className="py-3 px-6 text-center">Validation Status</th>
                  <th className="py-3 px-6 text-center">Poster Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filtered.map((res) => {
                  const champion = res.ranks.find(r => r.rank === 1);
                  return (
                    <tr key={res.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {res.competitionCode}
                          </span>
                          <span className="font-bold text-[#111111] text-sm">{res.competitionName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-[#111111]">
                        {res.categoryName} ({res.type})
                      </td>
                      <td className="py-4 px-6">
                        {champion ? (
                          <div>
                            <span className="font-bold text-[#111111] block">{champion.candidateName}</span>
                            <span className="text-[11px] text-[#526070]">{champion.teamName} ({champion.teamCode}) · {champion.score} pts</span>
                          </div>
                        ) : (
                          <span className="text-[#526070] italic">Result pending</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge variant="success" size="sm" dot>VERIFIED</Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge variant={res.posterReleased ? 'purple' : 'default'} size="sm">
                          {res.posterReleased ? 'RELEASED TO WEB' : 'IN STUDIO'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                          onClick={() => handleOpenStudio(res)}
                        >
                          Open Studio
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Poster Studio Modal */}
        <PosterStudioModal
          result={selectedResult}
          isOpen={posterStudioOpen}
          onClose={() => setPosterStudioOpen(false)}
        />

        {/* Theme Customizer Modal */}
        <ThemeCustomizerModal
          isOpen={themeCustomizerOpen}
          onClose={() => setThemeCustomizerOpen(false)}
        />
      </div>
    </AdminLayout>
  );
}
