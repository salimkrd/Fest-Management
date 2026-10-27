'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ChampionshipPodium } from '@/components/domain/ChampionshipPodium';
import {
  Search,
  Sparkles,
  ArrowRight,
  Download,
  ChevronRight
} from 'lucide-react';

export default function PublicResultHomePage() {
  const { theme, results, teams, categories } = useFest();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const publishedResults = results.filter(r => r.resultStatus === 'PUBLISHED');

  const filteredResults = publishedResults.filter(res => {
    const matchesSearch = res.competitionName.toLowerCase().includes(search.toLowerCase()) ||
                          res.competitionCode.toLowerCase().includes(search.toLowerCase()) ||
                          res.ranks.some(rk => rk.candidateName.toLowerCase().includes(search.toLowerCase()) || rk.bib.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'ALL' || res.categoryName === selectedCategory;
    return matchesSearch && matchesCat;
  });


  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* Themed Hero Banner */}
        <div 
          className="rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden transition-colors"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-black/10 blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Official Public Results Portal · {theme.year}
            </span>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mt-4 leading-tight">
              <span className="festival-name">{theme.festivalName}</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/90 leading-relaxed font-medium">
              {theme.heroBannerText || theme.tagline}
            </p>

            {/* Quick Live Search Bar */}
            <div className="mt-8 max-w-xl">
              <div className="relative">
                <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Search public results"
                  placeholder="Search candidate name, Bib number, or event..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm pl-12 pr-4 py-3.5 bg-white text-[#111111] placeholder:text-[#8E9CAE] rounded-2xl shadow-lg focus:outline-none focus:ring-4 focus:ring-white/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-[#111111] text-white shadow-sm'
                : 'bg-white text-[#526070] border border-[#E1E7EF] hover:bg-[#F8FAFC]'
            }`}
          >
            All Competitions
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat.name
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'bg-white text-[#526070] border border-[#E1E7EF] hover:bg-[#F8FAFC]'
              }`}
            >
              {cat.name} Tier
            </button>
          ))}
        </div>

        {/* Latest Published Results Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#111111] tracking-tight">
                Latest Published Results
              </h2>
              <p className="text-xs text-[#526070]">
                Verified contest outcomes authenticated by the Central Board of Adjudication
              </p>
            </div>
            <Link href="/public/directory" className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1">
              Browse All Archive <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-[#E1E7EF]">
                <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-[#111111]">No Results Found</h4>
                <p className="text-xs text-[#526070] mt-1">
                  Try adjusting your search query or selecting a different category division.
                </p>
              </div>
            ) : (
              filteredResults.map(res => {
                const rank1 = res.ranks.find(r => r.rank === 1);
                const rank2 = res.ranks.find(r => r.rank === 2);
                const rank3 = res.ranks.find(r => r.rank === 3);

                const cardClasses = 
                  theme.cardStyle === 'bordered' ? 'bg-white rounded-2xl border-2 border-[#E1E7EF] p-6 shadow-none' :
                  theme.cardStyle === 'glassmorphism' ? 'bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 p-6 shadow-md' :
                  theme.cardStyle === 'minimal' ? 'bg-white rounded-2xl border border-neutral-100 p-6 shadow-none' :
                  'bg-white rounded-2xl border border-[#E1E7EF] p-6 shadow-xs hover:shadow-md hover:border-neutral-300';

                return (
                  <div
                    key={res.id}
                    className={`${cardClasses} transition-all flex flex-col justify-between`}
                  >

                    <div>
                      {/* Event Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {res.competitionCode}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-[#526070]">
                          {res.categoryName} · {res.type}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#111111] leading-snug">
                        {res.competitionName}
                      </h3>
                      <p className="text-xs text-[#526070] mt-0.5">
                        Venue: {res.stageName}
                      </p>

                      {/* Winners Preview */}
                      <div className="mt-5 space-y-2.5">
                        {rank1 && (
                          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-amber-400 text-neutral-900 font-extrabold text-xs flex items-center justify-center shrink-0">
                                1
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-[#111111] leading-tight">{rank1.candidateName}</h4>
                                <span className="text-[10px] text-[#526070]">{rank1.teamName} ({rank1.teamCode})</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-bold text-amber-800 block">Grade {rank1.grade || '—'}</span>
                              <span className="text-xs font-extrabold text-emerald-700 block">+{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 0} pts</span>
                            </div>
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
                            <span className="text-right shrink-0"><span className="block text-[10px] font-bold text-[#2563EB]">Grade {rank2.grade || '—'}</span><span className="block text-[11px] font-extrabold text-emerald-700">+{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 0} pts</span></span>
                          </div>
                        )}

                        {rank3 && (
                          <div className="p-2 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                                3
                              </span>
                              <span className="font-medium text-[#111111] line-clamp-1">{rank3.candidateName}</span>
                            </div>
                            <span className="text-right shrink-0"><span className="block text-[10px] font-bold text-[#2563EB]">Grade {rank3.grade || '—'}</span><span className="block text-[11px] font-extrabold text-emerald-700">+{rank3.officialPoints ?? rank3.totalEarnedPoints ?? 0} pts</span></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Link */}
                    <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[10px] text-[#526070]">
                        Published: {res.publishedDate}
                      </span>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/public/posters?resultId=${encodeURIComponent(res.id)}`}
                          className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1"
                          aria-label={`Choose a poster template for ${res.competitionName}`}
                        >
                          <Download className="w-3.5 h-3.5" /> Download Poster
                        </Link>
                        <Link
                          href={`/public/competition/${res.competitionId}`}
                          className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 group"
                        >
                          Full Result <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Championship Standings Teaser / Podium */}
        <section className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#111111] tracking-tight">
                Official Championship Standings
              </h2>
              <p className="text-xs text-[#526070]">
                Accumulated points tally across solo, group, and category items
              </p>
            </div>
            <Link href="/public/championship" className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1">
              Complete Leaderboard <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <ChampionshipPodium teams={teams} />
        </section>
      </div>
    </PublicLayout>
  );
}
