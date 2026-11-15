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
    <div className="public-podium-card w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-xs">
      <div className="flex min-w-0 flex-col gap-3 mb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="public-card-title break-words text-sm sm:text-base font-bold">Championship Laureates Podium</h3>
          <p className="public-muted text-[11px]">Top three performing contingent houses in active standings</p>
        </div>
        <div className="public-page-eyebrow max-w-full self-start flex flex-wrap items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] sm:text-xs font-semibold sm:self-auto">
          <Trophy className="w-4 h-4 text-[#FDBF0F]" />
          <span className="min-w-0 break-words"><span className="festival-name">{theme.festivalName}</span> Trophy Race</span>
          <FestivalStatusBadge />
        </div>
      </div>

      {/* Podium Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end pt-6 pb-2 max-w-2xl mx-auto">
        {/* 2nd Place - Silver (Left) */}
        {second && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-[#C9BDAE] bg-[#F4EDE3] flex items-center justify-center text-[#4A0A1C] shadow-md mb-2 relative">
              <Award className="w-7 h-7 sm:w-8 sm:h-8" />
              <span className="absolute -bottom-2 bg-[#4A0A1C] text-[#FFF8EE] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                2nd
              </span>
            </div>
            <h4 className="public-card-title text-[11px] sm:text-xs font-bold text-center mt-2 line-clamp-1">
              {second.name}
            </h4>
            <span className="public-muted text-[10px] font-semibold">{second.code}</span>
            <div className="public-podium-base public-podium-second w-full border rounded-t-xl mt-3 pt-4 pb-3 text-center">
              <span className="text-lg sm:text-xl font-black text-[#4A0A1C] block">{second.totalPoints}</span>
              <span className="text-[9px] font-semibold text-[#6B5A50] uppercase">Points</span>
            </div>
          </div>
        )}

        {/* 1st Place - Gold (Center, Elevated) */}
        {first && (
          <div className="flex flex-col items-center -mt-4">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-4 border-[#FDBF0F] bg-[#FFF1BD] flex items-center justify-center text-[#86152C] shadow-xl mb-2 relative ring-4 ring-[#FDBF0F]/20">
              <Trophy className="w-8 h-8 sm:w-9 sm:h-9 text-[#A87400]" />
              <span className="absolute -bottom-2.5 bg-[#FDBF0F] text-[#1A080B] text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                1st
              </span>
            </div>
            <h4 className="public-card-title text-xs sm:text-sm font-extrabold text-center mt-2 line-clamp-1">
              {first.name}
            </h4>
            <span className="text-[10px] font-bold text-[#86152C]">{first.code} · LEADER</span>
            <div className="public-podium-base public-podium-first w-full border rounded-t-2xl mt-3 pt-6 pb-4 text-center shadow-xs">
              <span className="text-xl sm:text-2xl font-black text-[#4A0A1C] block">{first.totalPoints}</span>
              <span className="text-[9px] font-bold text-[#86152C] uppercase tracking-wider">Champion Pts</span>
            </div>
          </div>
        )}

        {/* 3rd Place - Bronze (Right) */}
        {third && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-[#B78647]/60 bg-[#F5E6D0] flex items-center justify-center text-[#795126] shadow-md mb-2 relative">
              <Medal className="w-7 h-7 sm:w-8 sm:h-8 text-[#795126]" />
              <span className="absolute -bottom-2 bg-[#795126] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                3rd
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-[#111111] text-center mt-2 line-clamp-1">
              {third.name}
            </h4>
            <span className="text-[11px] font-semibold text-[#526070]">{third.code}</span>
            <div className="public-podium-base public-podium-third w-full border rounded-t-xl mt-3 pt-3 pb-3 text-center">
              <span className="text-lg sm:text-xl font-black text-[#795126] block">{third.totalPoints}</span>
              <span className="text-[9px] font-semibold text-[#795126]/80 uppercase">Points</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
