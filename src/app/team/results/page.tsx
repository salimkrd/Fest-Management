'use client';

import React, { useState } from 'react';
import { TeamLayout } from '@/components/layout/TeamLayout';
import { useFest } from '@/context/FestContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Trophy, Award, Medal, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function TeamResultsPage() {
  const { currentTeamUser, teams, results } = useFest();
  const team = currentTeamUser
    ? teams.find(candidate => candidate.id === currentTeamUser.id) || currentTeamUser
    : null;

  const [search, setSearch] = useState('');

  // Extract all ranks won by this team across all published results
  const teamRankings = results.flatMap(res => {
    if (res.resultStatus !== 'PUBLISHED') return [];
    return res.ranks
      .filter(rk => rk.teamId === team?.id)
      .map(rk => ({
        ...rk,
        competitionName: res.competitionName,
        competitionCode: res.competitionCode,
        categoryName: res.categoryName,
        type: res.type,
        competitionId: res.competitionId,
        publishedDate: res.publishedDate
      }));
  });

  const filtered = teamRankings.filter(r =>
    r.candidateName.toLowerCase().includes(search.toLowerCase()) ||
    r.competitionName.toLowerCase().includes(search.toLowerCase()) ||
    r.competitionCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <TeamLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E1E7EF]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
              My Team Results &amp; Championship Tally
            </h1>
            <p className="text-xs text-[#526070] mt-1">
              Verified contest scores, position prizes, and Sahithyolsav points accredited to {team?.name}
            </p>
          </div>
          <Link href="/public/championship" target="_blank">
            <Button variant="outline" size="sm" leftIcon={<Trophy className="w-4 h-4 text-amber-500" />}>
              Live Public Championship Standings
            </Button>
          </Link>
        </div>

        {/* Team Score Card Banner */}
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-6 shadow-xs grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="col-span-2 lg:col-span-2 border-b lg:border-b-0 lg:border-r border-[#E1E7EF] pb-4 lg:pb-0 lg:pr-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#526070]">
              Accumulated Total Score
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-[#2563EB]">{team?.totalPoints}</span>
              <span className="text-sm font-bold text-[#526070]">Official Points</span>
            </div>
            <p className="text-xs text-[#526070] mt-1">
              Currently holding <strong className="text-[#111111]">Rank #{team?.rank}</strong> in overall festival championship
            </p>
          </div>

          <div className="p-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526070]">Solo Item Points</span>
            <span className="text-2xl font-bold text-[#111111] block mt-1">{team?.soloPoints} pts</span>
            <span className="text-[10px] text-[#526070]">Individual events</span>
          </div>

          <div className="p-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526070]">Group Item Points</span>
            <span className="text-2xl font-bold text-[#111111] block mt-1">{team?.groupPoints} pts</span>
            <span className="text-[10px] text-[#526070]">Troupe ensembles</span>
          </div>

          <div className="p-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526070]">Laureate Medals</span>
            <div className="flex items-center gap-2 mt-1 text-xs font-bold">
              <span className="text-amber-600">🥇 {team?.firstCount}</span>
              <span>•</span>
              <span className="text-slate-600">🥈 {team?.secondCount}</span>
              <span>•</span>
              <span className="text-amber-800">🥉 {team?.thirdCount}</span>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E1E7EF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-4 h-4 text-[#526070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search contestant or event..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E1E7EF] rounded-lg text-[#111111] focus:outline-none focus:bg-white focus:border-[#2563EB]"
              />
            </div>
            <span className="text-xs text-[#526070]">
              {filtered.length} Awarded Placings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3 px-6">Competition &amp; Code</th>
                  <th className="py-3 px-6">Participant / Ensemble</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6 text-center">Type</th>
                  <th className="py-3 px-6 text-center">Score</th>
                  <th className="py-3 px-6 text-center">Official Grade</th>
                  <th className="py-3 px-6 text-center">Prize Rank</th>
                  <th className="py-3 px-6 text-right">Team Championship Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#526070]">
                      No results published yet for competitions featuring {team?.name}.
                    </td>
                  </tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.registrationId} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {r.competitionCode}
                          </span>
                          <span className="font-bold text-[#111111]">{r.competitionName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-[#111111] block">{r.candidateName}</span>
                        <span className="text-[11px] font-mono text-[#526070]">{r.bib}</span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-[#111111]">
                        {r.categoryName}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.type === 'SOLO' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-[#111111]">
                        {r.score}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="font-bold text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                          Grade {r.grade}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {r.rank === 1 && <span className="font-extrabold text-amber-600">🥇 1st Place</span>}
                        {r.rank === 2 && <span className="font-extrabold text-slate-600">🥈 2nd Place</span>}
                        {r.rank === 3 && <span className="font-extrabold text-amber-800">🥉 3rd Place</span>}
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-emerald-600 text-sm">
                        +{r.totalEarnedPoints} pts
                        {r.type === 'GROUP' && <span className="block text-[10px] font-medium text-[#526070]">Team only</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TeamLayout>
  );
}
