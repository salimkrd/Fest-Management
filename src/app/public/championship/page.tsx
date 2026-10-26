'use client';

import React, { useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ChampionshipPodium } from '@/components/domain/ChampionshipPodium';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Trophy, Award, Medal, Sparkles, ChevronDown, ChevronUp, Share2 } from 'lucide-react';

export default function PublicChampionshipPage() {
  const { teams, theme } = useFest();

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const sortedTeams = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
  const totalFestPoints = sortedTeams.reduce((acc, t) => acc + t.totalPoints, 0) || 1;

  const toggleExpand = (id: string) => {
    setExpandedTeamId(prev => prev === id ? null : id);
  };

  return (
    <PublicLayout>
      <div className="space-y-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            Official <span className="festival-name">{theme.festivalName}</span> Trophy Race
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#111111] tracking-tight mt-3">
            Team Championship Standings
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#526070]">
            Live accumulated points table across all solo, group, stage, and literary competitions
          </p>
        </div>

        {/* Top 3 Podium Component */}
        <ChampionshipPodium teams={teams} />

        {/* Master Standings Table */}
        <div className="bg-white rounded-3xl border border-[#E1E7EF] shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-[#E1E7EF] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#111111]">Overall House Leaderboard</h3>
              <p className="text-xs text-[#526070]">Official points validated by festival tabulation desk</p>
            </div>
            <span className="text-xs text-[#526070] font-semibold">{teams.length} Competing Delegations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                  <th className="py-3.5 px-6">Rank</th>
                  <th className="py-3.5 px-6">Contingent House &amp; Insignia</th>
                  <th className="py-3.5 px-6 text-center">Solo Pts</th>
                  <th className="py-3.5 px-6 text-center">Group Pts</th>
                  <th className="py-3.5 px-6 text-center">Laureate Medals (1 / 2 / 3)</th>
                  <th className="py-3.5 px-6 text-center">Total Points</th>
                  <th className="py-3.5 px-6 w-36">Point Share %</th>
                  <th className="py-3.5 px-6 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EF]">
                {sortedTeams.map((team, idx) => {
                  const sharePercent = Math.round((team.totalPoints / totalFestPoints) * 100);
                  const isExpanded = expandedTeamId === team.id;

                  return (
                    <React.Fragment key={team.id}>
                      <tr className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-4 px-6 font-black text-sm text-[#111111]">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            idx === 0 ? 'bg-amber-400 text-neutral-900 font-black' :
                            idx === 1 ? 'bg-slate-300 text-neutral-900 font-bold' :
                            idx === 2 ? 'bg-amber-700 text-white font-bold' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs"
                              style={{ backgroundColor: team.color }}
                            >
                              {team.code}
                            </div>
                            <div>
                              <span className="font-bold text-[#111111] text-sm block">{team.name}</span>
                              <span className="text-[11px] text-[#526070]">{team.managerName} · {team.zone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-[#111111]">
                          {team.soloPoints}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-[#111111]">
                          {team.groupPoints}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2 font-bold text-xs">
                            <span className="text-amber-600">🥇 {team.firstCount}</span>
                            <span className="text-slate-500">🥈 {team.secondCount}</span>
                            <span className="text-amber-800">🥉 {team.thirdCount}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="text-xl font-black text-[#2563EB]">{team.totalPoints}</span>
                          <span className="text-[10px] text-[#526070] block">pts</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-[#526070]">
                              <span>{sharePercent}%</span>
                            </div>
                            <div className="w-full bg-[#F8FAFC] h-2 rounded-full overflow-hidden border border-[#E1E7EF]">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${sharePercent}%`,
                                  backgroundColor: team.color || '#2563EB'
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpand(team.id)}
                            className="p-1.5 rounded-lg text-[#526070] hover:text-[#111111] hover:bg-neutral-100 transition-colors"
                            aria-label="Expand team details"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Drawer inside table */}
                      {isExpanded && (
                        <tr className="bg-[#F8FAFC]">
                          <td colSpan={8} className="p-6">
                            <div className="p-4 bg-white rounded-xl border border-[#E1E7EF] space-y-3">
                              <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                                {team.name} Contingent Performance Summary
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-[#526070] block">Total Enrolled Contestants:</span>
                                  <span className="font-bold text-[#111111] text-sm">{team.contestantsCount} Students</span>
                                </div>
                                <div>
                                  <span className="text-[#526070] block">Events Competed:</span>
                                  <span className="font-bold text-[#111111] text-sm">{team.eventsCount} Events</span>
                                </div>
                                <div>
                                  <span className="text-[#526070] block">Gold Laureates (1st Place):</span>
                                  <span className="font-bold text-amber-600 text-sm">{team.firstCount} Medals</span>
                                </div>
                                <div>
                                  <span className="text-[#526070] block">Silver Laureates (2nd Place):</span>
                                  <span className="font-bold text-slate-700 text-sm">{team.secondCount} Medals</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
