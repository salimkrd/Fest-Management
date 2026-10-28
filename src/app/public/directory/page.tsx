'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Search, Trophy, ArrowRight, Sparkles, Filter, ChevronRight, Calendar, MapPin } from 'lucide-react';

function DirectoryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const { results, categories, theme } = useFest();

  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  useEffect(() => {
    if (initialQuery) setSearch(initialQuery);
  }, [initialQuery]);

  const publishedResults = results.filter(r => r.resultStatus === 'PUBLISHED');

  const filtered = publishedResults.filter(res => {
    const matchesSearch = res.competitionName.toLowerCase().includes(search.toLowerCase()) ||
                          res.competitionCode.toLowerCase().includes(search.toLowerCase()) ||
                          res.ranks.some(rk => rk.candidateName.toLowerCase().includes(search.toLowerCase()) || rk.bib.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'ALL' || res.categoryName === selectedCategory;
    const matchesType = selectedType === 'ALL' || res.type === selectedType;
    return matchesSearch && matchesCat && matchesType;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
          Public Results Directory &amp; Archive
        </h1>
        <p className="text-xs sm:text-sm text-[#526070] mt-1">
          Search published competition results and download a poster template
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E7EF] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="w-4 h-4 text-[#526070] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate name, Bib #, or competition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E1E7EF] rounded-xl text-[#111111] placeholder:text-[#8E9CAE] focus:outline-none focus:bg-white focus:border-[#2563EB]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            aria-label="Filter by Category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by Competition Format"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] text-[#111111] focus:outline-none"
          >
            <option value="ALL">All Formats</option>
            <option value="SOLO">Solo Items</option>
            <option value="GROUP">Group Ensembles</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[#526070]">
        <span>Showing {filtered.length} of {publishedResults.length} officially published events</span>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-[#2563EB] hover:underline font-semibold"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-[#E1E7EF]">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#111111]">No Results Found</h4>
            <p className="text-xs text-[#526070] mt-1">
              No published competition matches &ldquo;{search}&rdquo;. Try another search keyword.
            </p>
          </div>
        ) : (
          filtered.map(res => {
            const rank1 = res.ranks.find(r => r.rank === 1);
            const rank2 = res.ranks.find(r => r.rank === 2);
            const rank3 = res.ranks.find(r => r.rank === 3);

            return (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-[#E1E7EF] p-6 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {res.competitionCode}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#526070]">
                      {res.categoryName} · {res.type}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#111111] leading-snug">
                    {res.competitionName}
                  </h3>
                  <span className="text-xs text-[#526070] block mt-0.5">
                    Stage: {res.stageName}
                  </span>

                  {/* Laureates summary */}
                  <div className="mt-5 space-y-2">
                    {rank1 && (
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-400 text-neutral-900 font-black text-[10px] flex items-center justify-center shrink-0">
                            1
                          </span>
                          <span className="font-bold text-[#111111] line-clamp-1">{rank1.candidateName}</span>
                        </div>
                        <span className="shrink-0 text-right"><span className="block text-[10px] font-bold text-[#2563EB]">Grade {rank1.grade || '—'}</span><span className="block text-[11px] font-extrabold text-emerald-700">+{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 0} pts</span></span>
                      </div>
                    )}

                    {rank2 && (
                      <div className="p-2 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                            2
                          </span>
                          <span className="font-medium text-[#111111] line-clamp-1">{rank2.candidateName}</span>
                        </div>
                        <span className="shrink-0 text-right"><span className="block text-[10px] font-bold text-[#2563EB]">Grade {rank2.grade || '—'}</span><span className="block text-[11px] font-extrabold text-emerald-700">+{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 0} pts</span></span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] text-[#526070]">{res.publishedDate}</span>
                  <div className="flex items-center gap-3">
                    <PosterDownloadDialog result={res} theme={theme} />
                    <Link href={`/public/competition/${res.competitionId}`} className="flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] group">
                      View Result <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function PublicResultsDirectoryPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="p-12 text-center text-xs text-[#526070]">Loading results directory...</div>}>
        <DirectoryContent />
      </Suspense>
    </PublicLayout>
  );
}
