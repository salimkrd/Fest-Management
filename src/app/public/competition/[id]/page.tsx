'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { ResultRank } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { PosterDownloadDialog } from '@/components/domain/PosterDownloadDialog';
import {
  Trophy,
  Share2,
  ArrowLeft,
  Check,
  Calendar,
  MapPin,
  ShieldCheck,
  Award,
  Medal,
  Download,
  Layers,
  Sparkles,
  ExternalLink,
  Loader2
} from 'lucide-react';

interface WinnerPhotoProps {
  rank: ResultRank;
  photoUrl?: string;
  className: string;
}

/** Shows the participant's saved photo URL, with initials only if no usable photo exists. */
function WinnerPhoto({ rank, photoUrl = '', className }: WinnerPhotoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = (rank.candidateName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || '•';

  return (
    <div className={`${className} mx-auto overflow-hidden text-center`}>
      {photoUrl && !imageFailed ? (
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
          aria-label="Participant photo unavailable"
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function CompetitionDetailContent() {
  const params = useParams<{ id: string }>();
  const compId = params.id;
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
    setWinnerPhotos({});
    if (!result || result.resultStatus !== 'PUBLISHED') return () => { active = false; };

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
  }, [result?.id, result?.resultStatus]);

  const handleShare = async () => {
    setShareError(null);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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

  if (!result) {
    return (
      <div className="p-10 sm:p-14 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 max-w-2xl mx-auto my-8">
        <Trophy className="w-10 h-10 text-[#FDBF0F]/50 mx-auto mb-3" />
        <h2
          className="text-lg sm:text-xl font-bold uppercase text-[#F2F3E6]"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Competition Result Not Found
        </h2>
        <p className="text-xs text-[#F2F3E6]/70 mt-2 max-w-md mx-auto leading-relaxed">
          This competition result may still be under jury review and has not yet been officially ratified and published.
        </p>
        <div className="mt-6">
          <Link
            href="/public/directory"
            className="px-4 py-2 rounded-lg bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Results Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page-stack space-y-8 max-w-7xl mx-auto">
      {/* BREADCRUMB & ACTION TOOLBAR MATCHING STITCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-[#F2F3E6]/60">
          <Link href="/" className="hover:text-[#FDBF0F] transition-colors">
            HOME
          </Link>
          <span>/</span>
          <Link href="/public/directory" className="hover:text-[#FDBF0F] transition-colors">
            RESULTS DIRECTORY
          </Link>
          <span>/</span>
          <span className="text-[#FDBF0F] font-semibold uppercase">{result.categoryName}</span>
          <span>/</span>
          <span className="text-[#F2F3E6] font-mono font-bold">#{result.competitionCode}</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#230D0F] hover:bg-[#281014] text-[#F2F3E6] text-xs font-semibold border border-[#BA1912]/40 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#FDBF0F]" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B090B] hover:bg-[#230D0F] text-[#FDBF0F] text-xs font-semibold border border-[#FDBF0F]/30 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          <PosterDownloadDialog result={result} theme={theme} />
        </div>
      </div>

      {shareError && (
        <div role="alert" className="p-3 rounded-lg bg-[#2D1217] border border-red-500/40 text-xs text-red-200">
          {shareError}
        </div>
      )}

      {/* EVENT FRONTISPIECE BANNER */}
      <section className="relative w-full rounded-2xl bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] p-6 sm:p-10 border border-[#BA1912]/30 shadow-2xl overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-[#BA1912]/20 blur-[100px] rounded-full" />
        <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 bg-[#FDBF0F]/10 blur-[80px] rounded-full" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#FDBF0F] text-[#1B090B] font-mono text-xs font-extrabold uppercase shadow-sm">
                #{result.competitionCode}
              </span>
              <span className="px-2.5 py-1 rounded bg-[#1B090B] text-[#F2F3E6]/90 text-xs font-semibold uppercase border border-white/5">
                {result.categoryName} Division
              </span>
              <span className="px-2.5 py-1 rounded bg-[#1B090B] text-[#FDBF0F] text-xs font-semibold uppercase border border-[#FDBF0F]/30">
                {result.type} Contest
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#1B090B] text-[#FDBF0F] text-[11px] font-bold uppercase tracking-wider border border-[#FDBF0F]/40 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FDBF0F]" />
                Officially Ratified
              </span>
            </div>

            {/* Main Title */}
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#F2F3E6]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {result.competitionName}
            </h1>

            {/* Details strip */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#F2F3E6]/75 pt-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FDBF0F]" />
                <span>Venue: <strong>{result.stageName}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#FDBF0F]" />
                <span>Published on <strong>{result.publishedDate}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#FDBF0F]" />
                <span>Total Contestants: <strong>{result.ranks.length}</strong></span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* LAUREATE SANCTUM / SPOTLIGHT PODIUM CARDS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F]">
                Placing Accreditations
              </span>
            </div>
            <h2
              className="text-lg sm:text-xl font-bold uppercase text-[#F2F3E6] mt-0.5"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              The Laureates Sanctum
            </h2>
          </div>
          <span className="text-xs text-[#F2F3E6]/60">Grand Jury Ratified</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* RANK 2: Silver (Left) */}
          {rank2 && (
            <div className="md:order-1 flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#230D0F] border border-white/10 shadow-lg text-center relative">
              <div className="inline-block mx-auto text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-[#D8C8B7] text-[#1B090B] font-mono mb-4 shadow-sm">
                🥈 2nd Place Silver
              </div>

              <div>
                <WinnerPhoto
                  key={`${rank2.registrationId}:${winnerPhotos[rank2.registrationId] || ''}`}
                  rank={rank2}
                  photoUrl={winnerPhotos[rank2.registrationId]}
                  className="w-16 h-16 rounded-full border-2 border-[#D8C8B7] shadow-md mb-3"
                />

                <h3
                  className="text-base font-bold text-[#F2F3E6] leading-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {rank2.candidateName}
                </h3>
                <span className="text-xs font-mono text-[#D8C8B7] font-bold block mt-1">
                  Bib #{rank2.bib}
                </span>
                <p className="text-xs text-[#F2F3E6]/70 mt-1">
                  {rank2.teamName} ({rank2.teamCode})
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-left">
                <div>
                  <span className="text-[9px] uppercase font-bold text-[#F2F3E6]/60 block">Official Grade</span>
                  <span className="text-sm font-extrabold text-[#D8C8B7]">Grade {rank2.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-[#F2F3E6]/60 block">Accredited Points</span>
                  <span className="text-sm font-extrabold text-[#D8C8B7] font-mono">
                    +{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 0} pts
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* RANK 1: Gold Champion (Center Elevated) */}
          {rank1 && (
            <div className="md:order-2 flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-[#230D0F] border-2 border-[#FDBF0F] shadow-[0_0_30px_rgba(253,191,15,0.25)] text-center relative -mt-0 md:-mt-3">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider bg-[#FDBF0F] text-[#1B090B] font-mono shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#1B090B]" />
                🥇 1st Champion
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank1.registrationId}:${winnerPhotos[rank1.registrationId] || ''}`}
                  rank={rank1}
                  photoUrl={winnerPhotos[rank1.registrationId]}
                  className="w-20 h-20 rounded-full border-4 border-[#FDBF0F] ring-4 ring-[#FDBF0F]/20 shadow-xl mb-3"
                />

                <h3
                  className="text-lg font-extrabold text-[#F2F3E6] leading-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {rank1.candidateName}
                </h3>
                <span className="text-xs font-mono text-[#FDBF0F] font-bold block mt-1">
                  Bib #{rank1.bib}
                </span>
                <p className="text-xs text-[#F2F3E6]/85 font-semibold mt-1">
                  {rank1.teamName} ({rank1.teamCode})
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#FDBF0F]/30 grid grid-cols-2 gap-3 text-left">
                <div>
                  <span className="text-[9px] uppercase font-bold text-[#FDBF0F] block">Official Grade</span>
                  <span className="text-base font-black text-[#FDBF0F]">Grade {rank1.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-[#FDBF0F] block">Accredited Points</span>
                  <span className="text-base font-black text-[#FDBF0F] font-mono">
                    +{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 0} pts
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* RANK 3: Bronze (Right) */}
          {rank3 && (
            <div className="md:order-3 flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#230D0F] border border-white/10 shadow-lg text-center relative">
              <div className="inline-block mx-auto text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-[#86152C] text-[#FFF8EE] font-mono mb-4 shadow-sm border border-white/10">
                🥉 3rd Place Bronze
              </div>

              <div>
                <WinnerPhoto
                  key={`${rank3.registrationId}:${winnerPhotos[rank3.registrationId] || ''}`}
                  rank={rank3}
                  photoUrl={winnerPhotos[rank3.registrationId]}
                  className="w-16 h-16 rounded-full border-2 border-[#86152C] shadow-md mb-3"
                />

                <h3
                  className="text-base font-bold text-[#F2F3E6] leading-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {rank3.candidateName}
                </h3>
                <span className="text-xs font-mono text-[#FDBF0F]/80 font-bold block mt-1">
                  Bib #{rank3.bib}
                </span>
                <p className="text-xs text-[#F2F3E6]/70 mt-1">
                  {rank3.teamName} ({rank3.teamCode})
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-left">
                <div>
                  <span className="text-[9px] uppercase font-bold text-[#F2F3E6]/60 block">Official Grade</span>
                  <span className="text-sm font-extrabold text-[#F2F3E6]">Grade {rank3.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-[#F2F3E6]/60 block">Accredited Points</span>
                  <span className="text-sm font-extrabold text-[#FDBF0F] font-mono">
                    +{rank3.officialPoints ?? rank3.totalEarnedPoints ?? 0} pts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* COMMEMORATIVE POSTER FOLIO CTA BANNER MATCHING STITCH */}
      <section className="rounded-2xl bg-gradient-to-r from-[#230D0F] via-[#2D1217] to-[#230D0F] border border-[#BA1912]/40 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-4 h-4 text-[#FDBF0F]" />
            <span className="text-[10px] uppercase tracking-widest text-[#FDBF0F] font-bold">
              Released Media Studio Assets
            </span>
          </div>
          <h3
            className="text-base sm:text-lg font-bold uppercase text-[#F2F3E6]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Download Official Ratified Event Posters
          </h3>
          <p className="text-xs text-[#F2F3E6]/70 mt-1 max-w-xl leading-relaxed">
            Generate high-resolution social posters (Square 1:1, Story 9:16, Print A4) featuring the ratified laureates for {result.competitionName}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/public/posters?resultId=${encodeURIComponent(result.id)}`}
            className="px-4 py-2.5 rounded-lg bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Choose Poster Template</span>
          </Link>
        </div>
      </section>

      {/* COMPLETE TABULATION REGISTER TABLE */}
      <section className="w-full rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-[#BA1912]/30 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F]">
                Full Tabulation Register
              </span>
            </div>
            <h3
              className="text-base sm:text-lg font-bold uppercase text-[#F2F3E6] mt-0.5"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Complete Adjudication Roster
            </h3>
          </div>
          <span className="text-xs text-[#F2F3E6]/70 font-mono bg-[#1B090B] px-3 py-1.5 rounded-lg border border-white/5">
            {result.ranks.length} Evaluated Participants
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#BA1912]/20 bg-[#1B090B]/60 text-[10px] uppercase font-bold tracking-wider text-[#F2F3E6]/75">
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
                      <span className="text-[11px] text-[#F2F3E6]/50 uppercase font-medium">
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
                    <span className="text-[10px] text-[#F2F3E6]/60">({rk.teamCode})</span>
                  </td>

                  {/* Ratified Grade */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-1 rounded bg-[#1B090B] text-[#FDBF0F] border border-[#FDBF0F]/30 font-bold text-xs">
                      Grade {rk.grade || '—'}
                    </span>
                  </td>

                  {/* Points Accredited - Grade only, no raw scores! */}
                  <td className="py-3.5 px-4 text-right font-black text-[#FDBF0F] text-sm font-mono">
                    +{rk.officialPoints ?? rk.totalEarnedPoints ?? 0} pts
                    {result.type === 'GROUP' ? ' · Team' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* JURY BENCH RATIFICATION & DIGITAL SEAL */}
      <section className="rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B090B] border border-[#FDBF0F]/30 flex items-center justify-center shrink-0 text-[#FDBF0F]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4
              className="text-sm sm:text-base font-bold uppercase text-[#F2F3E6]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Jury Bench Ratification &amp; Validation
            </h4>
            <p className="text-xs text-[#F2F3E6]/70 mt-0.5 leading-relaxed">
              Ratified under the authority of the Central Directorate of Examination. Scores and placings are permanent and sealed for official convocation records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto text-xs font-mono text-[#FDBF0F] bg-[#1B090B] px-3.5 py-2 rounded-xl border border-[#FDBF0F]/30">
          <Check className="w-4 h-4 text-[#FDBF0F]" />
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
          <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 max-w-xl mx-auto text-xs text-[#F2F3E6]/70">
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
