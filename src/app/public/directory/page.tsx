'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import { useFest } from '@/context/FestContext';
import { Search, ArrowRight, Sparkles } from 'lucide-react';

function DirectoryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const { results, categories, theme } = useFest();

  const [search, setSearch] = useState(initialQuery);
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);

  if (prevInitialQuery !== initialQuery) {
    setPrevInitialQuery(initialQuery);
    setSearch(initialQuery);
  }

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

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
    <div className="public-page-stack space-y-7 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="public-page-title font-cinematic-editorial text-xl sm:text-2xl font-bold tracking-[0.1em]">
          Public Results Directory &amp; Archive
        </h1>
        <p className="public-page-description text-xs sm:text-sm mt-1">
          Search published competition results and download a poster template
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="public-filter-panel p-3.5 sm:p-4 rounded-xl border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="w-4 h-4 text-[#526070] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate name, Bib #, or competition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="public-control w-full text-xs pl-10 pr-4 py-2.5 rounded-lg focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            aria-label="Filter by Category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="public-control text-xs font-semibold py-2 px-3 rounded-lg focus:outline-none"
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
      <div className="public-results-count flex items-center justify-between text-xs">
        <span>Showing {filtered.length} of {publishedResults.length} officially published events</span>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="public-inline-link hover:underline font-semibold"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="public-results-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filtered.length === 0 ? (
          <div className="public-empty-state col-span-full p-8 sm:p-10 text-center rounded-xl border">
            <Sparkles className="w-7 h-7 text-[#FDBF0F] mx-auto mb-2" />
            <h4 className="public-card-title text-sm font-bold">No Results Found</h4>
            <p className="public-muted text-xs mt-1">
              No published competition matches &ldquo;{search}&rdquo;. Try another search keyword.
            </p>
          </div>
        ) : (
          filtered.map(res => {
            const rank1 = res.ranks.find(r => r.rank === 1);
            const rank2 = res.ranks.find(r => r.rank === 2);

            return (
              <div
                key={res.id}
                className="public-result-card rounded-xl border p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="public-code-badge font-mono text-[11px] font-bold px-2.5 py-1 rounded border">
                      {res.competitionCode}
                    </span>
                    <span className="public-muted text-[10px] font-bold uppercase">
                      {res.categoryName} · {res.type}
                    </span>
                  </div>

                  <h3 className="public-card-title text-sm sm:text-base font-bold leading-snug">
                    {res.competitionName}
                  </h3>
                  <span className="public-muted text-[11px] block mt-0.5">
                    Stage: {res.stageName}
                  </span>

                  {/* Laureates summary */}
                  <div className="mt-4 space-y-2">
                    {rank1 && (
                      <div className="public-winner-row public-winner-first p-2 rounded-lg border flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="public-rank-dot public-rank-first w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0">
                            1
                          </span>
                          <span className="public-winner-name font-bold line-clamp-1">{rank1.candidateName}</span>
                        </div>
                        <span className="shrink-0 text-right"><span className="public-grade-text block text-[10px] font-bold">Grade {rank1.grade || '—'}</span><span className="public-points-text block text-[10px] font-extrabold">+{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 0} pts</span></span>
                      </div>
                    )}

                    {rank2 && (
                      <div className="public-winner-row public-winner-secondary p-2 rounded-lg border flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="public-rank-dot public-rank-secondary w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0">
                            2
                          </span>
                          <span className="public-winner-name font-medium line-clamp-1">{rank2.candidateName}</span>
                        </div>
                        <span className="shrink-0 text-right"><span className="block text-[10px] font-bold text-[#2563EB]">Grade {rank2.grade || '—'}</span><span className="block text-[11px] font-extrabold text-emerald-700">+{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 0} pts</span></span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="public-card-footer mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-3">
                  <span className="public-muted text-[10px]">{res.publishedDate}</span>
                  <div className="flex items-center gap-3">
                    <PosterDownloadDialog result={res} theme={theme} />
                    <Link href={`/public/competition/${res.competitionId}`} className="public-inline-link flex items-center gap-1 text-xs font-bold group">
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
      <Suspense fallback={<div className="public-empty-state p-10 text-center text-xs">Loading results directory...</div>}>
        <DirectoryContent />
      </Suspense>
    </PublicLayout>
  );
}
