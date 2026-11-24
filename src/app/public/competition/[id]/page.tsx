'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { ResultRank } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { PublicIcon } from '@/components/layout/PublicIcon';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import { getPublishedOfficialPoints } from '@/domain/publicChampionship';
import { formatPublicPodiumSummary, getPodiumResultRanks } from '@/domain/publicResults';
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

interface PodiumLaureateCardProps {
  rank: ResultRank;
  position: 1 | 2 | 3;
  photoUrl?: string;
}

/** Renders one laureate card. Multiple cards can share the same official position. */
function PodiumLaureateCard({ rank, position, photoUrl }: PodiumLaureateCardProps) {
  const isGold = position === 1;
  const isSilver = position === 2;
  const borderClass = isGold
    ? 'border-2 border-[#FDBF0F] shadow-[0_0_35px_rgba(253,191,15,0.22)] p-6 sm:p-7'
    : isSilver
      ? 'border border-white/10 shadow-xl p-5 sm:p-6'
      : 'border border-[#BA1912]/40 shadow-xl p-5 sm:p-6';
  const badgeClass = isGold
    ? 'bg-[#FDBF0F] text-[#1B090B] font-black px-3 py-1'
    : isSilver
      ? 'bg-[#D8C8B7] text-[#1B090B] font-bold px-2.5 py-0.5'
      : 'bg-[#BA1912] text-[#F2F3E6] font-bold px-2.5 py-0.5';
  const accentClass = isGold ? 'text-[#FDBF0F]' : isSilver ? 'text-[#D8C8B7]' : 'text-[#BA1912]';
  const photoBorderClass = isGold
    ? 'border-2 border-[#FDBF0F]/50 shadow-xl'
    : isSilver
      ? 'border border-white/10 shadow-md'
      : 'border border-[#BA1912]/40 shadow-md';
  const positionTitle = isGold
    ? 'Rank 01 • Gold Champion'
    : isSilver
      ? 'Rank 02 • Silver Laureate'
      : 'Rank 03 • Bronze Laureate';
  const laureateTitle = isGold
    ? 'Festival Grand Laureate'
    : isSilver
      ? 'First Runner-Up'
      : 'Second Runner-Up';
  const points = getPublishedOfficialPoints(rank);

  return (
    <article className={`bg-[#230D0F] rounded-2xl flex flex-col justify-between relative transition-all duration-300 hover:-translate-y-1 ${borderClass}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-mono uppercase tracking-widest rounded flex items-center gap-1 shadow-xs ${badgeClass}`}>
            <PublicIcon name={isGold ? 'stars' : 'workspace_premium'} className={isGold ? 'text-[15px]' : 'text-[14px]'} />
            <span>{positionTitle}</span>
          </span>
          <span className={`text-xs font-mono font-bold uppercase tracking-wider shrink-0 ${accentClass}`}>
            Bib #{rank.bib}
          </span>
        </div>

        <div className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#1B090B] ${photoBorderClass}`}>
          <WinnerPhoto
            key={`${rank.registrationId}:${photoUrl || ''}`}
            rank={rank}
            photoUrl={photoUrl}
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1B090B] via-transparent to-transparent pointer-events-none" />
          {isGold && (
            <div className="absolute top-2 right-2 bg-[#BA1912] text-[#F2F3E6] px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold shadow-sm">
              Laurel Victor
            </div>
          )}
          <div className="absolute bottom-2.5 left-3">
            <span className={`text-[10px] font-mono uppercase tracking-wider bg-[#1B090B]/90 px-2 py-0.5 rounded font-bold border ${accentClass} ${isGold ? 'border-[#FDBF0F]/40' : isSilver ? 'border-white/10' : 'border-[#BA1912]/40'}`}>
              {rank.teamName} ({rank.teamCode})
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <span className={`text-[10px] font-mono uppercase tracking-widest font-semibold flex items-center gap-1 ${accentClass}`}>
            {isGold && <PublicIcon name="military_tech" className="text-[14px]" />}
            <span>{laureateTitle}</span>
          </span>
          <h3 className={`font-bold text-[#F2F3E6] uppercase tracking-wide leading-tight break-words ${isGold ? 'text-xl font-extrabold' : 'text-lg'}`}>
            {rank.candidateName}
          </h3>
          <p className={`text-xs ${isGold ? 'text-[#F2F3E6]/80 font-semibold' : 'text-[#F2F3E6]/70'}`}>
            {rank.teamName} Contingent
          </p>
        </div>

        <div className={`bg-[#1B090B] p-3 rounded-xl border flex items-center justify-between font-mono ${isGold ? 'p-3.5 border-[#FDBF0F]/40 shadow-inner' : 'border-white/5'}`}>
          <div>
            <span className={`text-[9px] uppercase tracking-wider block ${isGold ? 'text-[#FDBF0F] font-bold' : 'text-[#F2F3E6]/60'}`}>Ratified Merit</span>
            <span className={`font-extrabold ${isGold ? 'text-lg text-[#FDBF0F]' : `text-base ${isSilver ? 'text-[#D8C8B7]' : 'text-[#F2F3E6]'}`}`}>
              Grade {rank.grade || (isGold ? 'A+' : 'A')}
            </span>
          </div>
          <div className="text-right">
            <span className={`text-[9px] uppercase tracking-wider block ${isGold ? 'text-[#FDBF0F] font-bold' : 'text-[#F2F3E6]/60'}`}>Accredited Points</span>
            <span className={`font-black ${isGold ? 'text-lg text-[#FDBF0F]' : `text-base ${isSilver ? 'text-[#D8C8B7]' : 'text-[#FDBF0F]'}`}`}>
              {points === null ? 'Unavailable' : `+${points} PTS`}
            </span>
          </div>
        </div>
      </div>
    </article>
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

  const podiumRanks = result ? getPodiumResultRanks(result.ranks) : [];
  const rank1s = podiumRanks.filter(rank => rank.rank === 1);
  const rank2s = podiumRanks.filter(rank => rank.rank === 2);
  const rank3s = podiumRanks.filter(rank => rank.rank === 3);

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
        `*${theme.festivalName?.trim() || 'Official Festival'} — Official Ratified Result*\\n🏆 *${result?.competitionName}* (${result?.categoryName} Division)\\n${formatPublicPodiumSummary(podiumRanks)}\\n\\nView full official scorecard: ${window.location.href}`
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
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
        <PublicIcon name="military_tech" className="text-[48px] text-[#FDBF0F]/60 mx-auto mb-3 block" />
        <h2
          className="text-lg sm:text-2xl font-bold uppercase text-[#F2F3E6]"
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
            <PublicIcon name="arrow_back" className="text-[16px]" />
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
              <PublicIcon name="home" className="text-[14px]" />
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
                #8F9D-{result.competitionCode}-{theme.year || theme.festivalStartDate?.slice(0, 4) || 'UNSET'}
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
                <PublicIcon name="event_available" className="text-[14px] text-[#FDBF0F]" />
                <span>Published {result.publishedDate || 'Date unavailable'}</span>
              </span>
            </div>

            {/* Event Title */}
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#F2F3E6]"
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
              <PublicIcon name={copied ? 'check' : 'content_copy'} className="text-[16px] text-[#FDBF0F]" />
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 bg-[#1B090B] hover:bg-[#281014] text-[#FDBF0F] px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors border border-[#FDBF0F]/30 shadow-md"
            >
              <PublicIcon name="share" className="text-[16px]" />
              <span>Circulate</span>
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
              <PublicIcon name="school" className="text-[16px] text-[#FDBF0F]" />
              <span>{result.categoryName} Division</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Convocation Sanctum</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <PublicIcon name="temple_buddhist" className="text-[16px] text-[#FDBF0F]" />
              <span className="truncate">{result.stageName || 'Stage not specified'}</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Tribunal Quorum</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <PublicIcon name="balance" className="text-[16px] text-[#FDBF0F]" />
              <span>Chief Evaluator + Jury</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-[#F2F3E6]/60 uppercase tracking-widest block">Finalists &amp; Status</span>
            <span className="text-sm text-[#F2F3E6] font-bold flex items-center gap-1.5">
              <PublicIcon name="verified" className="text-[16px] text-[#FDBF0F]" />
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
      {/* LAUREATE PODIUM SPOTLIGHT (ALL TIED PODIUM RECIPIENTS)     */}
      {/* ========================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        <div className="md:col-span-4 order-2 md:order-1 space-y-5">
          {rank2s.map(rank => (
            <PodiumLaureateCard
              key={rank.registrationId}
              rank={rank}
              position={2}
              photoUrl={winnerPhotos[rank.registrationId]}
            />
          ))}
        </div>

        <div className="md:col-span-4 order-1 md:order-2 space-y-5 md:-translate-y-4">
          {rank1s.map(rank => (
            <PodiumLaureateCard
              key={rank.registrationId}
              rank={rank}
              position={1}
              photoUrl={winnerPhotos[rank.registrationId]}
            />
          ))}
        </div>

        <div className="md:col-span-4 order-3 space-y-5">
          {rank3s.map(rank => (
            <PodiumLaureateCard
              key={rank.registrationId}
              rank={rank}
              position={3}
              photoUrl={winnerPhotos[rank.registrationId]}
            />
          ))}
        </div>
      </section>

      {/* OFFICIAL RESULT POSTER DOWNLOAD */}
      <section className="rounded-2xl bg-gradient-to-r from-[#230D0F] via-[#2D1217] to-[#230D0F] border border-[#BA1912]/40 p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <PublicIcon name="download" className="text-[18px] text-[#FDBF0F]" />
            <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-bold font-mono">
              OFFICIAL RESULT POSTER
            </span>
          </div>
          <h3
            className="text-base sm:text-xl font-bold uppercase text-[#F2F3E6]"
          >
            Download Official Result Poster
          </h3>
          <p className="text-xs text-[#F2F3E6]/70 leading-relaxed font-sora">
            Choose from the released poster designs for this published competition and download a high-resolution image.
          </p>
        </div>

        <div className="shrink-0">
          <PosterDownloadDialog result={result} theme={theme} />
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
                    {getPublishedOfficialPoints(rk) === null ? 'Unavailable' : `+${getPublishedOfficialPoints(rk)} pts`}
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
                  {getPublishedOfficialPoints(rk) === null ? 'Unavailable' : `+${getPublishedOfficialPoints(rk)} pts`}
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
            <PublicIcon name="verified_user" className="text-[20px]" />
          </div>
          <div>
            <h4
              className="text-sm sm:text-base font-bold uppercase text-[#F2F3E6]"
            >
              Jury Bench Ratification &amp; Validation
            </h4>
            <p className="text-xs text-[#F2F3E6]/70 mt-0.5 leading-relaxed font-sora">
              Ratified under the authority of the Central Directorate of Examination. Scores and placings are permanent and sealed for official convocation records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-[#FDBF0F] bg-[#1B090B] px-3.5 py-2 rounded-xl border border-[#FDBF0F]/30">
          <PublicIcon name="check_circle" className="text-[16px]" />
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
