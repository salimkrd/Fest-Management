'use client';

import React from 'react';
import { Team } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { Trophy, Award, Medal, Sparkles, ShieldCheck } from 'lucide-react';

interface ChampionshipPodiumProps {
  teams: Team[];
}

export const ChampionshipPodium: React.FC<ChampionshipPodiumProps> = ({ teams }) => {
  const { theme } = useFest();
  const sorted = [...teams].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];
  const fourth = sorted[3];

  if (!first) return null;

  const totalPoints = sorted.reduce((sum, t) => sum + (t.totalPoints || 0), 0) || 1;
  const leaderMargin = second ? (first.totalPoints || 0) - (second.totalPoints || 0) : (first.totalPoints || 0);

  return (
    <section className="relative w-full rounded-2xl bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] p-5 sm:p-8 border border-[#BA1912]/30 shadow-2xl overflow-hidden">
      {/* Ambient Ruby & Gold Lighting */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#BA1912]/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-10 w-80 h-80 bg-[#FDBF0F]/10 rounded-full blur-3xl" />

      {/* Header Banner */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#BA1912]/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#FDBF0F]">
              Grand Convocation Laureate Podium
            </span>
          </div>
          <h2
            className="text-lg sm:text-2xl font-extrabold uppercase tracking-wide text-[#F2F3E6] mt-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Podium of Eminence
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-[#1B090B] border border-[#FDBF0F]/30 text-[#FDBF0F] text-xs font-semibold">
          <Trophy className="w-3.5 h-3.5 text-[#FDBF0F]" />
          <span className="tracking-wider uppercase text-[11px] font-mono">
            {theme.festivalName || 'INSPIRAATH'} Laurel Trophy Race
          </span>
        </div>
      </div>

      {/* DESKTOP PODIUM (Hidden on mobile) */}
      <div className="relative z-10 hidden md:grid grid-cols-12 gap-5 items-end pt-4 pb-2">
        {/* RANK 2: Silver (Left) */}
        {second && (
          <div className="col-span-4 order-1 flex flex-col items-center">
            <div className="w-full flex flex-col items-center p-5 rounded-2xl bg-[#1B090B]/90 border border-white/10 shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative mb-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 border-[#D8C8B7]"
                  style={{ backgroundColor: second.color || '#2D1217' }}
                >
                  <Award className="w-8 h-8 text-[#D8C8B7]" />
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#D8C8B7] text-[#1B090B] font-extrabold text-[10px] tracking-wider uppercase shadow-md font-mono">
                  Rank 02
                </span>
              </div>

              <span className="text-[10px] uppercase tracking-widest text-[#D8C8B7] font-bold mt-2">
                Silver Laureate
              </span>
              <h3
                className="text-base font-bold text-[#F2F3E6] uppercase tracking-wide mt-1 text-center truncate max-w-full"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {second.name}
              </h3>
              <p className="text-[11px] text-[#F2F3E6]/60 truncate max-w-full mt-0.5">
                {second.code} · {second.managerName || second.zone || 'Academic Delegation'}
              </p>

              {/* Points badge */}
              <div className="w-full py-2.5 px-3 rounded-xl bg-[#230D0F] border border-[#BA1912]/20 flex items-center justify-between my-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#F2F3E6]/70">Score</span>
                <span className="text-xl font-extrabold text-[#D8C8B7] font-mono">
                  {second.totalPoints}{' '}
                  <span className="text-xs font-normal text-[#D8C8B7]/70">PTS</span>
                </span>
              </div>

              {/* Medals row */}
              <div className="grid grid-cols-3 gap-1.5 w-full text-center py-1.5 px-2 rounded-lg bg-[#120507] border border-white/5">
                <div>
                  <span className="text-xs font-bold text-[#FDBF0F] block font-mono">{second.firstCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Gold</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#D8C8B7] block font-mono">{second.secondCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Silver</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#BA1912] block font-mono">{second.thirdCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Bronze</span>
                </div>
              </div>
            </div>

            {/* Podium Pedestal Base */}
            <div className="w-full h-20 bg-gradient-to-b from-[#230D0F] to-[#120507] border-t-2 border-[#D8C8B7]/60 rounded-b-xl flex items-center justify-center shadow-inner">
              <span className="text-2xl font-extrabold text-[#D8C8B7]/30 font-mono">2</span>
            </div>
          </div>
        )}

        {/* RANK 1: Gold Champion (Center Elevated) */}
        {first && (
          <div className="col-span-4 order-2 flex flex-col items-center -mt-6">
            <div className="w-full flex flex-col items-center p-6 rounded-2xl bg-[#230D0F] border-2 border-[#FDBF0F] shadow-[0_0_30px_rgba(253,191,15,0.25)] transition-all duration-300 hover:-translate-y-1 relative">
              {/* Crown Banner */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FDBF0F] text-[#1B090B] font-extrabold text-[10px] tracking-widest uppercase shadow-md flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3 text-[#1B090B]" />
                Champion Lead
              </div>

              <div className="relative my-2">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-4 border-[#FDBF0F] ring-4 ring-[#FDBF0F]/20"
                  style={{ backgroundColor: first.color || '#4A0A1C' }}
                >
                  <Trophy className="w-10 h-10 text-[#FDBF0F]" />
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#BA1912] text-[#F2F3E6] font-black text-[10px] tracking-wider uppercase shadow-md font-mono border border-[#FDBF0F]/40">
                  Rank 01
                </span>
              </div>

              <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-extrabold mt-2">
                Gold Laureate
              </span>
              <h3
                className="text-lg font-extrabold text-[#F2F3E6] uppercase tracking-wide mt-1 text-center truncate max-w-full"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {first.name}
              </h3>
              <p className="text-xs text-[#F2F3E6]/70 truncate max-w-full mt-0.5">
                {first.code} · {first.managerName || first.zone || 'Official Contender'}
              </p>

              {/* Points badge */}
              <div className="w-full py-3 px-3.5 rounded-xl bg-[#1B090B] border border-[#FDBF0F]/40 flex items-center justify-between my-3 shadow-inner">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#FDBF0F]">
                  Cumulative Score
                </span>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#FDBF0F] font-mono leading-none block">
                    {first.totalPoints}
                  </span>
                  <span className="text-[9px] font-bold text-[#FDBF0F]/80 uppercase tracking-widest">
                    +{leaderMargin} Adv
                  </span>
                </div>
              </div>

              {/* Medals row */}
              <div className="grid grid-cols-3 gap-2 w-full text-center py-2 px-2.5 rounded-lg bg-[#120507] border border-[#FDBF0F]/20">
                <div>
                  <span className="text-sm font-black text-[#FDBF0F] block font-mono">{first.firstCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#FDBF0F]/80 font-bold">Gold</span>
                </div>
                <div>
                  <span className="text-sm font-bold text-[#D8C8B7] block font-mono">{first.secondCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Silver</span>
                </div>
                <div>
                  <span className="text-sm font-bold text-[#BA1912] block font-mono">{first.thirdCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Bronze</span>
                </div>
              </div>
            </div>

            {/* Podium Pedestal Base */}
            <div className="w-full h-28 bg-gradient-to-b from-[#281014] to-[#120507] border-t-4 border-[#FDBF0F] rounded-b-xl flex items-center justify-center shadow-inner">
              <span className="text-4xl font-black text-[#FDBF0F]/30 font-mono">1</span>
            </div>
          </div>
        )}

        {/* RANK 3: Bronze (Right) */}
        {third && (
          <div className="col-span-4 order-3 flex flex-col items-center">
            <div className="w-full flex flex-col items-center p-5 rounded-2xl bg-[#1B090B]/90 border border-white/10 shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative mb-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 border-[#BA1912]"
                  style={{ backgroundColor: third.color || '#2D1217' }}
                >
                  <Medal className="w-8 h-8 text-[#FDBF0F]" />
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#BA1912] text-[#F2F3E6] font-extrabold text-[10px] tracking-wider uppercase shadow-md font-mono border border-white/10">
                  Rank 03
                </span>
              </div>

              <span className="text-[10px] uppercase tracking-widest text-[#BA1912] font-bold mt-2">
                Bronze Laureate
              </span>
              <h3
                className="text-base font-bold text-[#F2F3E6] uppercase tracking-wide mt-1 text-center truncate max-w-full"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {third.name}
              </h3>
              <p className="text-[11px] text-[#F2F3E6]/60 truncate max-w-full mt-0.5">
                {third.code} · {third.managerName || third.zone || 'Academic Delegation'}
              </p>

              {/* Points badge */}
              <div className="w-full py-2.5 px-3 rounded-xl bg-[#230D0F] border border-[#BA1912]/20 flex items-center justify-between my-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#F2F3E6]/70">Score</span>
                <span className="text-xl font-extrabold text-[#FDBF0F] font-mono">
                  {third.totalPoints}{' '}
                  <span className="text-xs font-normal text-[#FDBF0F]/70">PTS</span>
                </span>
              </div>

              {/* Medals row */}
              <div className="grid grid-cols-3 gap-1.5 w-full text-center py-1.5 px-2 rounded-lg bg-[#120507] border border-white/5">
                <div>
                  <span className="text-xs font-bold text-[#FDBF0F] block font-mono">{third.firstCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Gold</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#D8C8B7] block font-mono">{third.secondCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Silver</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#BA1912] block font-mono">{third.thirdCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60">Bronze</span>
                </div>
              </div>
            </div>

            {/* Podium Pedestal Base */}
            <div className="w-full h-14 bg-gradient-to-b from-[#230D0F] to-[#120507] border-t-2 border-[#BA1912] rounded-b-xl flex items-center justify-center shadow-inner">
              <span className="text-xl font-extrabold text-[#BA1912]/40 font-mono">3</span>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE PODIUM (Matching Stitch Mobile Design) */}
      <div className="relative z-10 md:hidden space-y-3">
        {/* Premier Gold Champion Card */}
        {first && (
          <div className="rounded-xl p-4 bg-[#230D0F] border-2 border-[#FDBF0F] shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0 border border-[#FDBF0F]/50 shadow-md"
                  style={{ backgroundColor: first.color || '#86152C' }}
                >
                  {first.code}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#BA1912] text-[#F2F3E6] font-mono">
                      Rank 01
                    </span>
                    <span className="text-[10px] tracking-widest uppercase font-bold text-[#FDBF0F]">
                      Gold Laureate
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#F2F3E6] mt-0.5 leading-tight">{first.name}</h3>
                  <p className="text-[10px] text-[#F2F3E6]/60">{first.managerName || first.zone || 'Leading Guild'}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-2xl font-black text-[#FDBF0F] font-mono leading-none block">
                  {first.totalPoints}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/70 block">Total PTS</span>
                <span className="text-[9px] font-bold text-[#FDBF0F] block">+{leaderMargin} Adv</span>
              </div>
            </div>

            {/* Medal breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-2 rounded-lg px-3 py-1.5 bg-[#1B090B] border border-[#BA1912]/40 text-center text-xs">
              <div>
                <span className="font-bold text-[#FDBF0F]">{first.firstCount || 0}</span>{' '}
                <span className="text-[10px] text-[#FDBF0F]">Gold</span>
              </div>
              <div>
                <span className="font-bold text-[#D8C8B7]">{first.secondCount || 0}</span>{' '}
                <span className="text-[10px] text-[#D8C8B7]">Silver</span>
              </div>
              <div>
                <span className="font-bold text-[#BA1912]">{first.thirdCount || 0}</span>{' '}
                <span className="text-[10px] text-[#BA1912]">Bronze</span>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Split Row for Rank 2 & 3 */}
        <div className="grid grid-cols-2 gap-3">
          {second && (
            <div className="rounded-xl p-3 bg-[#230D0F] border border-white/10 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#D8C8B7] text-[#1B090B] font-mono">
                  Rank 02
                </span>
                <span className="text-xs font-bold text-[#D8C8B7] font-mono">{second.totalPoints} pts</span>
              </div>
              <h4 className="text-xs font-bold text-[#F2F3E6] truncate mt-1">{second.name}</h4>
              <p className="text-[10px] text-[#F2F3E6]/60">{second.code}</p>
              <div className="flex items-center gap-2 text-[10px] text-[#F2F3E6]/70 mt-2 pt-1 border-t border-white/5">
                <span>🥇 {second.firstCount || 0}</span>
                <span>🥈 {second.secondCount || 0}</span>
                <span>🥉 {second.thirdCount || 0}</span>
              </div>
            </div>
          )}

          {third && (
            <div className="rounded-xl p-3 bg-[#230D0F] border border-white/10 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#BA1912] text-[#F2F3E6] font-mono">
                  Rank 03
                </span>
                <span className="text-xs font-bold text-[#FDBF0F] font-mono">{third.totalPoints} pts</span>
              </div>
              <h4 className="text-xs font-bold text-[#F2F3E6] truncate mt-1">{third.name}</h4>
              <p className="text-[10px] text-[#F2F3E6]/60">{third.code}</p>
              <div className="flex items-center gap-2 text-[10px] text-[#F2F3E6]/70 mt-2 pt-1 border-t border-white/5">
                <span>🥇 {third.firstCount || 0}</span>
                <span>🥈 {third.secondCount || 0}</span>
                <span>🥉 {third.thirdCount || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4th Place Commendation Banner (if 4+ teams exist) */}
      {fourth && (
        <div className="relative z-10 mt-4 p-3 rounded-xl bg-[#1B090B] border border-[#BA1912]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#230D0F] text-[#F2F3E6]/70 font-mono text-[10px] font-bold">
              RANK 04
            </span>
            <span className="text-[#F2F3E6] font-bold">{fourth.name}</span>
            <span className="text-[#F2F3E6]/60">({fourth.code})</span>
            <span className="hidden sm:inline text-[#FDBF0F]/60">•</span>
            <span className="hidden sm:inline text-[11px] text-[#F2F3E6]/70">Honorable Guild Commendation</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#FDBF0F] font-bold font-mono">{fourth.totalPoints} PTS</span>
            <span className="text-[#F2F3E6]/60 text-[10px]">
              🥇 {fourth.firstCount || 0} · 🥈 {fourth.secondCount || 0} · 🥉 {fourth.thirdCount || 0}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
