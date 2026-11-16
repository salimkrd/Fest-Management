'use client';

import React from 'react';
import { Team } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { PublicIcon } from '@/components/layout/PublicIcon';

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
  const firstSharePercent = totalPoints > 0 ? ((first.totalPoints || 0) / totalPoints * 100).toFixed(1) : '0';

  return (
    <section className="relative w-full rounded-2xl bg-[#1B090B] border border-[#BA1912]/30 p-4 sm:p-7 shadow-2xl overflow-hidden">
      {/* Background Ambient Radiance */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-[#BA1912]/20 via-[#FDBF0F]/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-10 w-80 h-80 bg-[#FDBF0F]/10 rounded-full blur-3xl" />

      {/* Podium Section Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#BA1912]/20">
        <div>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#FDBF0F] block">
            SCHOLASTIC LAUREATE TIER
          </span>
          <h2
            className="text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-wide text-[#F2F3E6] mt-0.5"
          >
            GRAND CONVOCATION PODIUM
          </h2>
        </div>

        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#230D0F] border border-[#FDBF0F]/30 text-[#FDBF0F] text-xs font-semibold shadow-xs">
          <PublicIcon name="military_tech" className="text-[18px] text-[#FDBF0F]" />
          <span className="tracking-wider uppercase text-[11px] font-mono">
            {theme.festivalName?.trim() || 'Festival'} LAUREL CUP
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP PHYSICAL PODIUM (Hidden on mobile)               */}
      {/* ========================================================= */}
      <div className="relative z-10 hidden md:grid grid-cols-12 gap-5 items-end pt-4 pb-2">
        {/* RANK 2: BAGHDAD / SILVER LAUREATE (Left Column) */}
        {second && (
          <div className="col-span-4 order-1 flex flex-col items-center">
            <div className="w-full flex flex-col items-center p-5 rounded-t-xl bg-[#230D0F] border-t border-x border-[#D8C8B7]/30 shadow-xl transition-all duration-300 hover:-translate-y-1">
              {/* Crest & Badge */}
              <div className="relative mb-3">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center shadow-inner border-2 border-[#D8C8B7]/60"
                  style={{ backgroundColor: second.color || '#2A1618' }}
                >
                  <span className="text-xl font-black text-[#D8C8B7] font-mono">
                    {second.code}
                  </span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#1B090B] text-[#D8C8B7] font-mono font-bold text-[10px] tracking-widest uppercase shadow border border-[#D8C8B7]/30 whitespace-nowrap">
                  RANK 02
                </div>
              </div>

              {/* Guild Details */}
              <span className="text-[10px] uppercase tracking-widest text-[#D8C8B7] font-bold mt-2">
                SILVER LAUREATE
              </span>
              <h3
                className="text-lg font-bold text-[#F2F3E6] uppercase tracking-wide mt-1 text-center truncate max-w-full"
              >
                {second.name}
              </h3>
              <p className="text-[11px] text-[#F2F3E6]/60 truncate max-w-full text-center mt-0.5">
                {second.managerName || second.zone || 'Architects of Scholastic Tradition'}
              </p>

              {/* Points Counter Badge */}
              <div className="w-full py-2.5 px-3 rounded-lg bg-[#1B090B] border border-white/5 flex items-center justify-between my-3 shadow-inner">
                <span className="text-[10px] uppercase tracking-wider text-[#F2F3E6]/70 font-semibold">
                  Cumulative Score
                </span>
                <span className="text-xl font-black text-[#D8C8B7] font-mono tracking-tight">
                  {second.totalPoints}{' '}
                  <span className="text-xs font-normal text-[#D8C8B7]/70">PTS</span>
                </span>
              </div>

              {/* Medals Breakdown Mini Row */}
              <div className="grid grid-cols-3 gap-1.5 w-full text-center py-2 px-2 rounded-lg bg-[#1B090B]/80 border border-white/5">
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

            {/* Physical Podium Pedestal Block (Silver - Medium Height) */}
            <div className="w-full h-24 bg-gradient-to-b from-[#2A1618] to-[#1B090B] border-t-2 border-[#D8C8B7]/80 rounded-b-xl flex flex-col items-center justify-center shadow-inner">
              <span className="text-3xl font-extrabold text-[#D8C8B7]/40 font-serif leading-none">
                II
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#D8C8B7]/70 font-bold mt-1">
                SECOND PLACE
              </span>
            </div>
          </div>
        )}

        {/* RANK 1: CORDOBA / GOLD CHAMPION (Center Elevated Column) */}
        {first && (
          <div className="col-span-4 order-2 flex flex-col items-center -mt-6">
            {/* Crown Header Banner */}
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-t-lg bg-[#FDBF0F] text-[#1B090B] text-[10px] font-black uppercase tracking-widest shadow-lg">
              <PublicIcon name="workspace_premium" className="text-[16px]" />
              <span>DEFENDING PREMIER LEADER</span>
            </div>

            <div className="w-full flex flex-col items-center p-5 sm:p-6 rounded-b-none rounded-t-none bg-[#230D0F] border-2 border-b-0 border-[#FDBF0F] shadow-[0_0_35px_rgba(253,191,15,0.22)] relative overflow-hidden">
              {/* Radiant Gold Shimmer Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#FDBF0F]/15 via-transparent to-transparent pointer-events-none" />

              {/* Insignia & Laurel */}
              <div className="relative mb-3 mt-1">
                <div
                  className="w-24 h-24 rounded-full p-1 flex items-center justify-center shadow-2xl border-2 border-[#FDBF0F] ring-4 ring-[#FDBF0F]/20"
                  style={{ backgroundColor: first.color || '#4A0A1C' }}
                >
                  <div className="w-full h-full rounded-full bg-[#1B090B] flex items-center justify-center">
                    <span className="text-2xl font-black text-[#FDBF0F] font-mono">
                      {first.code}
                    </span>
                  </div>
                </div>
                <div className="absolute -top-2.5 -right-2 px-2 py-0.5 rounded bg-[#BA1912] text-[#F2F3E6] text-[10px] uppercase font-mono font-bold shadow-md border border-[#FDBF0F]/40">
                  ★ RANK 01
                </div>
              </div>

              {/* Guild Name & Motto */}
              <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-extrabold">
                GOLDEN DIADEM GUILD
              </span>
              <h3
                className="text-xl font-extrabold text-[#F2F3E6] uppercase tracking-wide mt-1 text-center truncate max-w-full"
              >
                {first.name}
              </h3>
              <p className="text-xs text-[#FDBF0F]/80 italic truncate max-w-full text-center mt-0.5">
                {first.managerName || first.zone || 'Luminaries of Wisdom & Sacred Inquiry'}
              </p>

              {/* Points Hero Box */}
              <div className="w-full py-3 px-4 rounded-xl bg-[#1B090B] border border-[#FDBF0F]/40 flex flex-col items-center justify-center my-3 shadow-inner">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl lg:text-4xl font-black text-[#FDBF0F] font-mono leading-none">
                    {first.totalPoints}
                  </span>
                  <span className="text-xs font-bold text-[#FDBF0F] uppercase">PTS</span>
                </div>
                <span className="text-[10px] font-bold text-[#FDBF0F] bg-[#230D0F] px-2.5 py-0.5 rounded mt-1 uppercase tracking-wider border border-[#FDBF0F]/30">
                  ▲ +{leaderMargin} PTS ADVANTAGE
                </span>
              </div>

              {/* Medals Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 w-full text-center py-2 px-2.5 rounded-lg bg-[#1B090B] border border-[#FDBF0F]/20">
                <div className="py-0.5">
                  <span className="text-sm font-black text-[#FDBF0F] block font-mono">{first.firstCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#FDBF0F]/90 font-bold">Gold Medals</span>
                </div>
                <div className="py-0.5">
                  <span className="text-sm font-bold text-[#D8C8B7] block font-mono">{first.secondCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60 font-semibold">Silver</span>
                </div>
                <div className="py-0.5">
                  <span className="text-sm font-bold text-[#BA1912] block font-mono">{first.thirdCount || 0}</span>
                  <span className="text-[9px] uppercase text-[#F2F3E6]/60 font-semibold">Bronze</span>
                </div>
              </div>
            </div>

            {/* Physical Podium Pedestal Block (Gold - Highest) */}
            <div className="w-full h-32 bg-gradient-to-b from-[#281014] to-[#120507] border-2 border-t-0 border-[#FDBF0F] rounded-b-xl flex flex-col items-center justify-center shadow-inner">
              <span className="text-4xl font-black text-[#FDBF0F]/40 font-serif leading-none">
                I
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#FDBF0F] font-extrabold mt-1">
                CONVOCATION CHAMPION TIER
              </span>
            </div>
          </div>
        )}

        {/* RANK 3: DAMASCUS / BRONZE LAUREATE (Right Column) */}
        {third && (
          <div className="col-span-4 order-3 flex flex-col items-center">
            <div className="w-full flex flex-col items-center p-5 rounded-t-xl bg-[#230D0F] border-t border-x border-[#BA1912]/40 shadow-xl transition-all duration-300 hover:-translate-y-1">
              {/* Crest & Badge */}
              <div className="relative mb-3">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center shadow-inner border-2 border-[#BA1912]"
                  style={{ backgroundColor: third.color || '#2A1618' }}
                >
                  <span className="text-xl font-black text-[#FDBF0F] font-mono">
                    {third.code}
                  </span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#1B090B] text-[#BA1912] font-mono font-bold text-[10px] tracking-widest uppercase shadow border border-[#BA1912]/40 whitespace-nowrap">
                  RANK 03
                </div>
              </div>

              {/* Guild Details */}
              <span className="text-[10px] uppercase tracking-widest text-[#BA1912] font-bold mt-2">
                BRONZE LAUREATE
              </span>
              <h3
                className="text-lg font-bold text-[#F2F3E6] uppercase tracking-wide mt-1 text-center truncate max-w-full"
              >
                {third.name}
              </h3>
              <p className="text-[11px] text-[#F2F3E6]/60 truncate max-w-full text-center mt-0.5">
                {third.managerName || third.zone || 'Dialectics of Sacred Rhetoric'}
              </p>

              {/* Points Counter Badge */}
              <div className="w-full py-2.5 px-3 rounded-lg bg-[#1B090B] border border-white/5 flex items-center justify-between my-3 shadow-inner">
                <span className="text-[10px] uppercase tracking-wider text-[#F2F3E6]/70 font-semibold">
                  Cumulative Score
                </span>
                <span className="text-xl font-black text-[#FDBF0F] font-mono tracking-tight">
                  {third.totalPoints}{' '}
                  <span className="text-xs font-normal text-[#FDBF0F]/70">PTS</span>
                </span>
              </div>

              {/* Medals Breakdown Mini Row */}
              <div className="grid grid-cols-3 gap-1.5 w-full text-center py-2 px-2 rounded-lg bg-[#1B090B]/80 border border-white/5">
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

            {/* Physical Podium Pedestal Block (Bronze - Lowest Height) */}
            <div className="w-full h-16 bg-gradient-to-b from-[#2A1618] to-[#1B090B] border-t-2 border-[#BA1912] rounded-b-xl flex flex-col items-center justify-center shadow-inner">
              <span className="text-2xl font-extrabold text-[#BA1912]/50 font-serif leading-none">
                III
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#BA1912]/80 font-bold mt-1">
                THIRD PLACE
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MOBILE 4-COLOR EDITION PODIUM (Visible only on mobile)   */}
      {/* ========================================================= */}
      <div className="relative z-10 md:hidden space-y-3">
        {/* Premier Gold Champion Card (Cordoba) */}
        {first && (
          <div className="rounded-xl p-4 bg-[#230D0F] border-2 border-[#FDBF0F] shadow-lg relative overflow-hidden">
            {/* Faint Watermark Insignia */}
            <div className="absolute -right-3 -bottom-3 opacity-10 pointer-events-none">
              <PublicIcon name="workspace_premium" className="text-[100px] text-[#FDBF0F]" />
            </div>

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shrink-0 border border-[#FDBF0F]/50 shadow-md font-mono"
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
                  <p className="text-[10px] text-[#F2F3E6]/70">{first.managerName || first.zone || 'Academic Delegation'}</p>
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

            {/* Medal Breakdown Pill Strip */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-2 rounded-lg px-3 py-1.5 bg-[#1B090B] border border-[#BA1912]/40 text-center text-xs relative z-10">
              <div>
                <span className="font-bold text-[#FDBF0F] font-mono">{first.firstCount || 0}</span>{' '}
                <span className="text-[10px] text-[#FDBF0F]/80 uppercase">Gold</span>
              </div>
              <div>
                <span className="font-bold text-[#D8C8B7] font-mono">{first.secondCount || 0}</span>{' '}
                <span className="text-[10px] text-[#D8C8B7]/80 uppercase">Silver</span>
              </div>
              <div>
                <span className="font-bold text-[#BA1912] font-mono">{first.thirdCount || 0}</span>{' '}
                <span className="text-[10px] text-[#BA1912]/80 uppercase">Bronze</span>
              </div>
            </div>

            {/* Point Share Bar */}
            <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1 relative z-10">
              <div className="flex items-center justify-between text-[10px] text-[#F2F3E6]/70 font-mono">
                <span>Point Share in Festival</span>
                <span className="text-[#FDBF0F] font-bold">{firstSharePercent}%</span>
              </div>
              <div className="w-full bg-[#1B090B] h-1.5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-[#FDBF0F] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(Number(firstSharePercent), 5)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Compact Tier 2 & Tier 3 Split Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Silver Podium: Baghdad */}
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
              <div className="flex items-center justify-between text-[10px] text-[#F2F3E6]/70 mt-2 pt-1.5 border-t border-white/5 font-mono">
                <span>🥇 {second.firstCount || 0}</span>
                <span>🥈 {second.secondCount || 0}</span>
                <span>🥉 {second.thirdCount || 0}</span>
              </div>
            </div>
          )}

          {/* Bronze Podium: Damascus */}
          {third && (
            <div className="rounded-xl p-3 bg-[#230D0F] border border-[#BA1912]/40 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#BA1912] text-[#F2F3E6] font-mono">
                  Rank 03
                </span>
                <span className="text-xs font-bold text-[#FDBF0F] font-mono">{third.totalPoints} pts</span>
              </div>
              <h4 className="text-xs font-bold text-[#F2F3E6] truncate mt-1">{third.name}</h4>
              <p className="text-[10px] text-[#F2F3E6]/60">{third.code}</p>
              <div className="flex items-center justify-between text-[10px] text-[#F2F3E6]/70 mt-2 pt-1.5 border-t border-white/5 font-mono">
                <span>🥇 {third.firstCount || 0}</span>
                <span>🥈 {third.secondCount || 0}</span>
                <span>🥉 {third.thirdCount || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rank 4 Commendation Ribbon Below Podium (if 4+ teams exist) */}
      {fourth && (
        <div className="relative z-10 mt-4 p-3 rounded-xl bg-[#230D0F] border border-[#BA1912]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1B090B] border border-white/5 flex items-center justify-center text-[#F2F3E6] font-bold font-mono shrink-0">
              04
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-[#F2F3E6]/60 font-semibold">
                  Honorable Commendation
                </span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-[10px] text-[#FDBF0F] uppercase font-mono font-bold">{fourth.code}</span>
              </div>
              <h4 className="font-bold text-[#F2F3E6]">{fourth.name}</h4>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 self-end md:self-auto font-mono text-xs">
            <div className="flex items-center gap-2 text-[#F2F3E6]/70 text-[11px]">
              <span><strong className="text-[#FDBF0F]">{fourth.firstCount || 0}</strong> Gold</span>
              <span><strong className="text-[#D8C8B7]">{fourth.secondCount || 0}</strong> Silver</span>
              <span><strong className="text-[#BA1912]">{fourth.thirdCount || 0}</strong> Bronze</span>
            </div>
            <div className="px-3 py-1 rounded bg-[#1B090B] border border-white/5 text-[#FDBF0F] font-bold">
              {fourth.totalPoints} PTS
            </div>
            <span className="text-[10px] text-[#F2F3E6]/50 uppercase tracking-wider">
              -{first.totalPoints - fourth.totalPoints} pts from leader
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
