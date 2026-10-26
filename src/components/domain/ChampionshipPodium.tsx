'use client';

import React from 'react';
import { Team } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { FestivalStatusBadge } from '@/components/domain/FestivalBrand';
import { Trophy, Award, Medal } from 'lucide-react';

interface ChampionshipPodiumProps {
  teams: Team[];
}

export const ChampionshipPodium: React.FC<ChampionshipPodiumProps> = ({ teams }) => {
  const { theme } = useFest();
  const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  if (!first) return null;

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E1E7EF] p-6 shadow-xs">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-base font-bold text-[#111111]">Championship Laureates Podium</h3>
          <p className="text-xs text-[#526070]">Top three performing contingent houses in active standings</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-600" />
          <span><span className="festival-name">{theme.festivalName}</span> Trophy Race</span>
          <FestivalStatusBadge />
        </div>
      </div>

      {/* Podium Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end pt-6 pb-2 max-w-2xl mx-auto">
        {/* 2nd Place - Silver (Left) */}
        {second && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-slate-300 bg-slate-50 flex items-center justify-center text-slate-700 shadow-md mb-2 relative">
              <Award className="w-7 h-7 sm:w-8 sm:h-8" />
              <span className="absolute -bottom-2 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                2nd
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-[#111111] text-center mt-2 line-clamp-1">
              {second.name}
            </h4>
            <span className="text-[11px] font-semibold text-[#526070]">{second.code}</span>
            <div className="w-full bg-slate-100 border border-slate-200 rounded-t-xl mt-3 pt-5 pb-4 text-center">
              <span className="text-lg sm:text-2xl font-black text-slate-800 block">{second.totalPoints}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Points</span>
            </div>
          </div>
        )}

        {/* 1st Place - Gold (Center, Elevated) */}
        {first && (
          <div className="flex flex-col items-center -mt-6">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 bg-amber-50 flex items-center justify-center text-amber-600 shadow-xl mb-2 relative ring-4 ring-amber-100 animate-pulse">
              <Trophy className="w-9 h-9 sm:w-10 sm:h-10 text-amber-500" />
              <span className="absolute -bottom-2.5 bg-amber-500 text-neutral-900 text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                1st
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-[#111111] text-center mt-2 line-clamp-1">
              {first.name}
            </h4>
            <span className="text-xs font-bold text-[#2563EB]">{first.code} · LEADER</span>
            <div className="w-full bg-gradient-to-b from-amber-100 to-amber-50 border border-amber-200 rounded-t-2xl mt-3 pt-8 pb-5 text-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-amber-900 block">{first.totalPoints}</span>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Champion Pts</span>
            </div>
          </div>
        )}

        {/* 3rd Place - Bronze (Right) */}
        {third && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-amber-700/60 bg-amber-50/50 flex items-center justify-center text-amber-800 shadow-md mb-2 relative">
              <Medal className="w-7 h-7 sm:w-8 sm:h-8 text-amber-700" />
              <span className="absolute -bottom-2 bg-amber-800 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                3rd
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-[#111111] text-center mt-2 line-clamp-1">
              {third.name}
            </h4>
            <span className="text-[11px] font-semibold text-[#526070]">{third.code}</span>
            <div className="w-full bg-amber-50/80 border border-amber-200/80 rounded-t-xl mt-3 pt-3 pb-3 text-center">
              <span className="text-lg sm:text-2xl font-black text-amber-900 block">{third.totalPoints}</span>
              <span className="text-[10px] font-semibold text-amber-700/70 uppercase">Points</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
