'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { ResultRank } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import { Loader2 } from 'lucide-react';

interface WinnerPhotoProps {
  rank: ResultRank;
  photoUrl?: string;
  className: string;
}

/** Shows the participant's saved photo URL, with initials only if no usable photo exists. */
function WinnerPhoto({ rank, photoUrl = '', className }: WinnerPhotoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials =
    (rank.candidateName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || '•';

  return (
    <div className={`${className} mx-auto overflow-hidden text-center shrink-0`}>
      {photoUrl && !imageFailed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photoUrl}
          alt={rank.candidateName ? `${rank.candidateName} profile photo` : 'Participant photo'}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-[#1B090B] text-sm sm:text-base font-extrabold text-[#FDBF0F] border border-[#FDBF0F]/30"
          aria-label="Participant photo placeholder"
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function CompetitionDetailContent() {
  const params = useParams<{ id: string }>();
  const compId = params?.id;
  const { results, theme, resultsSyncState } = useFest();

  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Find result for this competition
  const result = useMemo(() => {
    return results.find(
      r => (r.competitionId === compId || r.id === compId) && r.resultStatus === 'PUBLISHED'
    );
  }, [results, compId]);

  const rank1 = result?.ranks.find(r => r.rank === 1);
  const rank2 = result?.ranks.find(r => r.rank === 2);
  const rank3 = result?.ranks.find(r => r.rank === 3);

  const [winnerPhotos, setWinnerPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    if (!result || result.resultStatus !== 'PUBLISHED') {
      return () => {
        active = false;
      };
    }

    fetch(`/api/public/results/${encodeURIComponent(result.id)}/winner-photos`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return { photos: {} as Record<string, string> };
        const payload = await response.json();
        return payload && payload.photos && typeof payload.photos === 'object'
          ? { photos: payload.photos as Record<string, string> }
          : { photos: {} as Record<string, string> };
      })
      .then(payload => {
        if (active) setWinnerPhotos(payload.photos);
      })
      .catch(() => {
        if (active) setWinnerPhotos({});
      });

    return () => {
      active = false;
    };
  }, [result]);

  const handleShare = async () => {
    setShareError(null);
    try {
      if (typeof window !== 'undefined') {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setShareError('Unable to copy the link. You can copy it from your address bar.');
    }
  };

  const handleWhatsAppShare = () => {
    if (typeof window !== 'undefined') {
      const text = encodeURIComponent(
        `*${theme.festivalName || 'INSPIRAATH'} — Official Ratified Result*\n🏆 *${result?.competitionName}* (${result?.categoryName} Division)\n🥇 1st Place: ${rank1?.candidateName || 'N/A'} (${rank1?.teamCode || ''})\n\nView full official scorecard: ${window.location.href}`
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  const handlePrintGazette = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (resultsSyncState === 'loading' && !result) {
    return (
      <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 max-w-xl mx-auto my-8">
        <Loader2 className="w-8 h-8 text-[#FDBF0F] animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-bold text-[#F2F3E6]">Loading Competition Scorecard…</h3>
        <p className="text-xs text-[#F2F3E6]/60 mt-1">Fetching official ratified adjudication records</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-10 sm:p-14 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 max-w-2xl mx-auto my-8 shadow-2xl">
        <span className="material-symbols-outlined text-[48px] text-[#FDBF0F]/60 mx-auto mb-3 block">
          military_tech
        </span>
        <h2
          className="text-lg sm:text-2xl font-bold uppercase text-[#F2F3E6]"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Competition Result Not Found
        </h2>
        <p className="text-xs text-[#F2F3E6]/70 mt-2 max-w-md mx-auto leading-relaxed font-sora">
          This competition result may still be under jury review or tabulation and has not yet been officially ratified and published.
        </p>
        <div className="mt-6">
          <Link
            href="/public/directory"
            className="px-4 py-2.5 rounded-lg bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors shadow-md"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Return to Results Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page-stack space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* ========================================================= */}
      {/* TOP AUDIT ANCHOR & BREADCRUMB BAR                         */}
      {/* ========================================================= */}
      <section className="w-full bg-[#1B090B]/80 backdrop-blur-md px-3 sm:px-6 py-3 rounded-xl border border-[#BA1912]/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Breadcrumb Hierarchy */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#F2F3E6]/60 flex-wrap">
            <Link href="/" className="hover:text-[#FDBF0F] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">home</span>
              <span>Home</span>
            </Link>
            <span className="text-[#FDBF0F]/60">/</span>
            <Link href="/public/directory" className="hover:text-[#FDBF0F] transition-colors">
              Results Directory
            </Link>
            <span className="text-[#FDBF0F]/60">/</span>
            <span className="text-[#D8C8B7] font-semibold">{result.categoryName} Division</span>
            <span className="text-[#FDBF0F]/60">/</span>
            <span className="text-[#FDBF0F] font-bold">#{result.competitionCode}</span>
          </nav>

          {/* Ratification & Verification Seal */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#BA1912] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-ping" />
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-[#F2F3E6]">
                Ratified &amp; Sealed by Grand Jury
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-[#F2F3E6]/70">
              <span className="text-[#F2F3E6]/40">Tab Hash:</span>
              <code className="bg-[#230D0F] px-1.5 py-0.5 rounded text-[#FDBF0F] border border-white/5">
                #8F9D-{result.competitionCode}-2026
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* EDITORIAL EVENT FRONTISPIECE HEADER                       */}
      {/* ========================================================= */}
      <header className="relative bg-[#230D0F] p-5 sm:p-8 rounded-2xl border border-[#BA1912]/30 shadow-2xl overflow-hidden">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#BA1912]/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 bg-[#FDBF0F]/10 blur-[80px] rounded-full" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Meta Tags */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#BA1912] text-[#F2F3E6] font-mono text-xs font-bold uppercase shadow-sm">
                #{result.competitionCode}
              </span>
              <span className="px-2.5 py-1 rounded bg-[#1B090B] text-[#FDBF0F] font-mono text-xs font-semibold uppercase border border-[#FDBF0F]/30">
                {result.stageName || 'Main Stage'}
              </span>
              <span className="px-2.5 py-1 rounded bg-[#1B090B] text-[#F2F3E6]/80 text-xs font-medium uppercase border border-white/5 flex items-center gap-1 font-mono">
                <span className="material-symbols-outlined text-[14px] text-[#FDBF0F]">event_available</span>
                <span>Published {result.publishedDate || '2026 Nov 24'}</span>
              </span>
            </div>

            {/* Event Title */}
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#F2F3E6]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {result.competitionName}
            </h1>

            <p className="text-xs sm:text-sm text-[#F2F3E6]/75 max-w-2xl leading-relaxed font-sora">
              Rules of Tajweed, Maqamat &amp; Vocal Cadence. Official convocation adjudication and ratified merit scores.
            </p>
          </div>

          {/* Quick Folio Dispatches */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-[#1B090B] hover:bg-[#281014] text-[#F2F3E6] px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors border border-white/10 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 bg-[#1B090B] hover:bg-[#281014] text-[#FDBF0F] px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors border border-[#FDBF0F]/30 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Circulate</span>
            </button>

            <button
              type="button"
              onClick={handlePrintGazette}
              className="flex items-center gap-1.5 bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>Official Gazette PDF</span>
            </button>
          </div>
        </div>

        {shareError && (
          <div role="alert" className="mt-4 p-3 rounded-lg bg-[#2D1217] border border-red-500/40 text-xs text-red-200 font-mono">
            {shareError}
          </div>
        )}

        {/* Scholastic Metadata Ledger Strip */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#BA1912]/20 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Cadre &amp; Tier</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">school</span>
              <span>{result.categoryName} Division</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Convocation Sanctum</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">temple_buddhist</span>
              <span className="truncate">{result.stageName || 'Main Stage Sanctum'}</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Tribunal Quorum</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">balance</span>
              <span>Chief Evaluator + Jury</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Finalists &amp; Status</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#FDBF0F]">verified</span>
              <span>{result.ranks.length} Evaluated • Ratified</span>
            </span>
          </div>
        </div>
      </header>

      {/* Section Divider Ornament */}
      <div className="flex items-center justify-center gap-4 py-1 opacity-80">
        <span className="h-px bg-gradient-to-r from-transparent to-[#FDBF0F] flex-1 max-w-xs" />
        <div className="flex items-center gap-2 text-[#FDBF0F] text-xs font-mono uppercase tracking-widest">
          <span>❖</span>
          <span className="font-bold">Laureate Sanctum</span>
          <span>◆</span>
          <span className="text-[#F2F3E6]/70">Tripartite Honor Roll</span>
          <span>❖</span>
        </div>
        <span className="h-px bg-gradient-to-l from-transparent to-[#FDBF0F] flex-1 max-w-xs" />
      </div>

      {/* ========================================================= */}
      {/* LAUREATE PODIUM SPOTLIGHT (TOP 3 WINNERS)                  */}
      {/* ========================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        {/* RANK 2: Silver Laureate (Left) */}
        {rank2 && (
          <article className="md:col-span-4 bg-[#230D0F] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl border border-white/10 relative order-2 md:order-1 transition-all duration-300 hover:-translate-y-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded bg-[#D8C8B7] text-[#1B090B] font-bold flex items-center gap-1 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                  <span>Rank 02 • Silver Laureate</span>
                </span>
                <span className="text-xs font-mono text-[#D8C8B7] font-bold uppercase tracking-wider">
                  Bib #{rank2.bib}
                </span>
              </div>

              {/* Photo Focus */}
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#1B090B] border border-white/10 shadow-md">
                <WinnerPhoto
                  key={`${rank2.registrationId}:${winnerPhotos[rank2.registrationId] || ''}`}
                  rank={rank2}
                  photoUrl={winnerPhotos[rank2.registrationId]}
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B090B] via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2.5 left-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#D8C8B7] bg-[#1B090B]/90 px-2 py-0.5 rounded font-bold border border-white/10">
                    {rank2.teamName} ({rank2.teamCode})
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#D8C8B7] uppercase tracking-widest block font-semibold">
                  First Runner-Up
                </span>
                <h3
                  className="text-lg font-bold text-[#F2F3E6] uppercase tracking-wide leading-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {rank2.candidateName}
                </h3>
                <p className="text-xs text-[#F2F3E6]/70">{rank2.teamName} Contingent</p>
              </div>

              {/* Score Matrix Summary - Strict Grade-Only */}
              <div className="bg-[#1B090B] p-3 rounded-xl border border-white/5 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 block">Ratified Merit</span>
                  <span className="text-base font-extrabold text-[#D8C8B7]">Grade {rank2.grade || 'A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 block">Accredited Points</span>
                  <span className="text-base font-black text-[#D8C8B7]">
                    +{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 5} PTS
                  </span>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* RANK 1: Gold Laureate (Center Luminary) */}
        {rank1 && (
          <article className="md:col-span-4 bg-[#230D0F] rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-[0_0_35px_rgba(253,191,15,0.22)] border-2 border-[#FDBF0F] relative order-1 md:order-2 md:-translate-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-[#FDBF0F] text-[#1B090B] font-black flex items-center gap-1 shadow-md">
                  <span className="material-symbols-outlined text-[15px]">stars</span>
                  <span>Rank 01 • Gold Champion</span>
                </span>
                <span className="text-xs font-mono text-[#FDBF0F] font-bold uppercase tracking-wider">
                  Bib #{rank1.bib}
                </span>
              </div>

              {/* Photo Focus */}
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#1B090B] border-2 border-[#FDBF0F]/50 shadow-xl">
                <WinnerPhoto
                  key={`${rank1.registrationId}:${winnerPhotos[rank1.registrationId] || ''}`}
                  rank={rank1}
                  photoUrl={winnerPhotos[rank1.registrationId]}
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B090B] via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-2 right-2 bg-[#BA1912] text-[#F2F3E6] px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold shadow-sm">
                  Laurel Victor
                </div>
                <div className="absolute bottom-2.5 left-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#FDBF0F] bg-[#1B090B]/90 px-2 py-0.5 rounded font-bold border border-[#FDBF0F]/40">
                    {rank1.teamName} ({rank1.teamCode})
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#FDBF0F] uppercase tracking-widest font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">military_tech</span>
                  <span>Festival Grand Laureate</span>
                </span>
                <h3
                  className="text-xl font-extrabold text-[#F2F3E6] uppercase tracking-wide leading-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {rank1.candidateName}
                </h3>
                <p className="text-xs text-[#F2F3E6]/80 font-semibold">{rank1.teamName} Contingent</p>
              </div>

              {/* Score Matrix Summary - Strict Grade-Only */}
              <div className="bg-[#1B090B] p-3.5 rounded-xl border border-[#FDBF0F]/40 flex items-center justify-between font-mono shadow-inner">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[#FDBF0F] block font-bold">Ratified Merit</span>
                  <span className="text-lg font-black text-[#FDBF0F]">Grade {rank1.grade || 'A+'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-[#FDBF0F] block font-bold">Accredited Points</span>
                  <span className="text-lg font-black text-[#FDBF0F]">
                    +{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 10} PTS
                  </span>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* RANK 3: Bronze Laureate (Right) */}
        {rank3 && (
          <article className="md:col-span-4 bg-[#230D0F] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl border border-[#BA1912]/40 relative order-3 md:order-3 transition-all duration-300 hover:-translate-y-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded bg-[#BA1912] text-[#F2F3E6] font-bold flex items-center gap-1 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                  <span>Rank 03 • Bronze Laureate</span>
                </span>
                <span className="text-xs font-mono text-[#BA1912] font-bold uppercase tracking-wider">
                  Bib #{rank3.bib}
                </span>
              </div>

              {/* Photo Focus */}
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#1B090B] border border-[#BA1912]/40 shadow-md">
                <WinnerPhoto
                  key={`${rank3.registrationId}:${winnerPhotos[rank3.registrationId] || ''}`}
                  rank={rank3}
                  photoUrl={winnerPhotos[rank3.registrationId]}
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B090B] via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2.5 left-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#BA1912] bg-[#1B090B]/90 px-2 py-0.5 rounded font-bold border border-[#BA1912]/40">
                    {rank3.teamName} ({rank3.teamCode})
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#BA1912] uppercase tracking-widest block font-semibold">
                  Second Runner-Up
                </span>
                <h3
                  className="text-lg font-bold text-[#F2F3E6] uppercase tracking-wide leading-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {rank3.candidateName}
                </h3>
                <p className="text-xs text-[#F2F3E6]/70">{rank3.teamName} Contingent</p>
              </div>

              {/* Score Matrix Summary - Strict Grade-Only */}
              <div className="bg-[#1B090B] p-3 rounded-xl border border-white/5 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 block">Ratified Merit</span>
                  <span className="text-base font-extrabold text-[#F2F3E6]">Grade {rank3.grade || 'A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-[#F2F3E6]/60 block">Accredited Points</span>
                  <span className="text-base font-black text-[#FDBF0F]">
                    +{rank3.officialPoints ?? rank3.totalEarnedPoints ?? 3} PTS
                  </span>
                </div>
              </div>
            </div>
          </article>
        )}
      </section>

      {/* ========================================================= */}
      {/* COMMEMORATIVE POSTER FOLIO CTA BANNER                     */}
      {/* ========================================================= */}
      <section className="rounded-2xl bg-gradient-to-r from-[#230D0F] via-[#2D1217] to-[#230D0F] border border-[#BA1912]/40 p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#FDBF0F]">download</span>
            <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-bold font-mono">
              Digital Media Repository
            </span>
          </div>
          <h3
            className="text-base sm:text-xl font-bold uppercase text-[#F2F3E6]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Download Official Ratified Event Posters
          </h3>
          <p className="text-xs text-[#F2F3E6]/70 leading-relaxed font-sora">
            Authentic archival folios formatted for high-definition digital dissemination, architectural display screens, and social archives. Pre-rendered with Grand Secretariat seals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <PosterDownloadDialog result={result} theme={theme} />

          <Link
            href={`/public/posters?resultId=${encodeURIComponent(result.id)}`}
            className="px-4 py-2.5 rounded-lg bg-[#1B090B] hover:bg-[#281014] text-[#FDBF0F] text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors border border-[#FDBF0F]/30 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">palette</span>
            <span>View All Templates</span>
          </Link>
        </div>
      </section>

      {/* ========================================================= */}
      {/* COMPLETE TABULATION REGISTER TABLE (FULL ADJUDICATED)     */}
      {/* ========================================================= */}
      <section className="w-full rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 shadow-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#BA1912]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#FDBF0F] text-[10px] font-bold uppercase tracking-widest font-mono">
              <span>Full Tabulation Register</span>
              <span>•</span>
              <span>Official Convocation Records</span>
            </div>
            <h3
              className="text-lg sm:text-xl font-bold uppercase text-[#F2F3E6] mt-0.5"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Certified Contestant Tabulation Ledger
            </h3>
          </div>
          <span className="text-xs text-[#F2F3E6]/70 font-mono bg-[#1B090B] px-3 py-1.5 rounded-lg border border-white/5 self-start sm:self-auto">
            {result.ranks.length} Evaluated Participants
          </span>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#BA1912]/20 bg-[#1B090B]/60 text-[10px] font-mono uppercase font-bold tracking-wider text-[#F2F3E6]/75">
                <th className="py-3.5 px-4 text-center w-20">Rank</th>
                <th className="py-3.5 px-4">Candidate / Ensemble</th>
                <th className="py-3.5 px-4 font-mono">Bib #</th>
                <th className="py-3.5 px-4">Contingent Delegation</th>
                <th className="py-3.5 px-4 text-center">Ratified Grade</th>
                <th className="py-3.5 px-4 text-right">Points Accredited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BA1912]/15">
              {result.ranks.map(rk => (
                <tr key={rk.registrationId} className="hover:bg-[#281014]/60 transition-colors">
                  {/* Placing Rank */}
                  <td className="py-3.5 px-4 text-center">
                    {rk.rank === 1 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#FDBF0F] text-[#1B090B] font-mono font-black text-xs shadow-xs">
                        🥇 1st
                      </span>
                    )}
                    {rk.rank === 2 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#D8C8B7] text-[#1B090B] font-mono font-bold text-xs shadow-xs">
                        🥈 2nd
                      </span>
                    )}
                    {rk.rank === 3 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#86152C] text-[#FFF8EE] font-mono font-bold text-xs shadow-xs">
                        🥉 3rd
                      </span>
                    )}
                    {!rk.rank && (
                      <span className="text-[11px] text-[#F2F3E6]/50 uppercase font-medium font-mono">
                        Participated
                      </span>
                    )}
                  </td>

                  {/* Candidate */}
                  <td className="py-3.5 px-4 font-bold text-[#F2F3E6] text-sm">
                    {rk.candidateName}
                  </td>

                  {/* Bib */}
                  <td className="py-3.5 px-4 font-mono text-xs text-[#FDBF0F] font-bold">
                    #{rk.bib}
                  </td>

                  {/* Delegation */}
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[#F2F3E6]">{rk.teamName}</span>{' '}
                    <span className="text-[10px] text-[#F2F3E6]/60 font-mono">({rk.teamCode})</span>
                  </td>

                  {/* Ratified Grade */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-1 rounded bg-[#1B090B] text-[#FDBF0F] border border-[#FDBF0F]/30 font-bold text-xs font-mono">
                      Grade {rk.grade || '—'}
                    </span>
                  </td>

                  {/* Points Accredited */}
                  <td className="py-3.5 px-4 text-right font-black text-[#FDBF0F] text-sm font-mono">
                    +{rk.officialPoints ?? rk.totalEarnedPoints ?? 0} pts
                    {result.type === 'GROUP' ? ' · Team' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="block md:hidden p-4 space-y-3">
          {result.ranks.map(rk => (
            <div
              key={rk.registrationId}
              className="p-3.5 rounded-xl bg-[#1B090B] border border-white/5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {rk.rank === 1 && (
                    <span className="px-2 py-0.5 rounded bg-[#FDBF0F] text-[#1B090B] font-mono font-black text-xs">
                      🥇 Rank 01
                    </span>
                  )}
                  {rk.rank === 2 && (
                    <span className="px-2 py-0.5 rounded bg-[#D8C8B7] text-[#1B090B] font-mono font-bold text-xs">
                      🥈 Rank 02
                    </span>
                  )}
                  {rk.rank === 3 && (
                    <span className="px-2 py-0.5 rounded bg-[#86152C] text-[#FFF8EE] font-mono font-bold text-xs">
                      🥉 Rank 03
                    </span>
                  )}
                  {!rk.rank && (
                    <span className="text-[10px] uppercase font-mono text-[#F2F3E6]/50 bg-[#230D0F] px-2 py-0.5 rounded">
                      Participated
                    </span>
                  )}
                  <span className="font-mono text-xs font-bold text-[#FDBF0F]">Bib #{rk.bib}</span>
                </div>

                <span className="text-xs font-black text-[#FDBF0F] font-mono">
                  +{rk.officialPoints ?? rk.totalEarnedPoints ?? 0} pts
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#F2F3E6]">{rk.candidateName}</h4>
                <p className="text-[11px] text-[#F2F3E6]/70 mt-0.5">
                  {rk.teamName} <span className="font-mono text-[#FDBF0F]">({rk.teamCode})</span>
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-mono">
                <span className="text-[#F2F3E6]/60">Official Grade:</span>
                <span className="px-2 py-0.5 rounded bg-[#230D0F] text-[#FDBF0F] font-bold border border-[#FDBF0F]/30">
                  Grade {rk.grade || '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================= */}
      {/* JURY BENCH RATIFICATION & DIGITAL SEAL                    */}
      {/* ========================================================= */}
      <section className="rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B090B] border border-[#FDBF0F]/30 flex items-center justify-center shrink-0 text-[#FDBF0F]">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div>
            <h4
              className="text-sm sm:text-base font-bold uppercase text-[#F2F3E6]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Jury Bench Ratification &amp; Validation
            </h4>
            <p className="text-xs text-[#F2F3E6]/70 mt-0.5 leading-relaxed font-sora">
              Ratified under the authority of the Central Directorate of Examination. Scores and placings are permanent and sealed for official convocation records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-[#FDBF0F] bg-[#1B090B] px-3.5 py-2 rounded-xl border border-[#FDBF0F]/30">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>Verification Pass Confirmed</span>
        </div>
      </section>
    </div>
  );
}

export default function PublicCompetitionDetailPage() {
  return (
    <PublicLayout>
      <Suspense
        fallback={
          <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 max-w-xl mx-auto text-xs text-[#F2F3E6]/70 font-mono">
            <Loader2 className="w-6 h-6 text-[#FDBF0F] animate-spin mx-auto mb-2" />
            Loading competition result…
          </div>
        }
      >
        <CompetitionDetailContent />
      </Suspense>
    </PublicLayout>
  );
}
