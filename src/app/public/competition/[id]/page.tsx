'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import type { ResultRank } from '@/types/fest';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Trophy,
  Share2,
  ArrowLeft,
  Check,
  Download,
  Calendar,
  MapPin
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
    .split(/\\s+/)
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
        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-lg font-extrabold text-slate-400" aria-label="Participant photo unavailable">
          {initials}
        </div>
      )}
    </div>
  );
}

function CompetitionDetailContent() {
  const params = useParams<{ id: string }>();
  const compId = params.id;
  const { results, theme } = useFest();

  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Find result for this competition
  const result = results.find(r =>
    (r.competitionId === compId || r.id === compId) && r.resultStatus === 'PUBLISHED'
  );

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
      .then(payload => { if (active) setWinnerPhotos(payload.photos); })
      .catch(() => { if (active) setWinnerPhotos({}); });

    return () => { active = false; };
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
      const text = encodeURIComponent(`*${theme.festivalName} - Official Result*\n🏆 *${result?.competitionName}* (${result?.categoryName})\n🥇 1st Place: ${rank1?.candidateName || 'N/A'} (${rank1?.teamCode || ''})\n\nView full tabulation sheet: ${window.location.href}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  if (!result) {
    return (
      <PublicLayout>
        <div className="public-empty-state p-8 sm:p-10 text-center rounded-2xl border max-w-2xl mx-auto">
          <h2 className="public-card-title text-base font-bold">Competition Result Not Found</h2>
          <p className="public-muted text-xs mt-1">This competition result may not be published yet.</p>
          <Link href="/public/directory" className="public-inline-link mt-4 inline-block text-xs font-bold">
            ← Return to Results Directory
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <div className="public-page-stack space-y-7 max-w-5xl mx-auto">
      {/* Back Link & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/public"
          className="public-inline-link inline-flex items-center gap-2 text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Results</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="public-action-button"
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            onClick={handleShare}
          >
            {copied ? 'Link Copied' : 'Share Link'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="public-action-button public-action-button-secondary"
            onClick={handleWhatsAppShare}
          >
            WhatsApp
          </Button>
        </div>
      </div>

      {shareError && <p role="alert" className="public-alert text-xs">{shareError}</p>}

      {/* Event Header Banner */}
      <div className="public-event-header rounded-2xl border p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="public-code-badge font-mono text-[11px] font-bold px-2.5 py-1 rounded border">
                {result.competitionCode}
              </span>
              <span className="public-muted text-[10px] font-bold uppercase tracking-wider">
                {result.categoryName} Division · {result.type} Contest
              </span>
              <Badge variant="success" size="sm" dot className="public-published-badge">OFFICIALLY PUBLISHED</Badge>
            </div>

            <h1 className="public-page-title font-cinematic-editorial text-xl sm:text-2xl font-bold tracking-[0.08em]">
              {result.competitionName}
            </h1>

            <div className="public-muted mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Venue: {result.stageName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Published on {result.publishedDate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* The Laureates Podium */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="public-section-title font-cinematic-editorial text-base sm:text-lg font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#C58B00]" />
            The Laureates Podium
          </h2>
          <span className="public-muted text-[10px]">Published Placings</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* 1st Place - Gold (Elevated) */}
          {rank1 && (
            <div className="public-winner-card public-winner-first md:order-2 rounded-2xl border-2 p-4 sm:p-5 shadow-md text-center relative flex flex-col justify-between">
              <div className="public-winner-label public-winner-label-first absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-black px-3 py-1 rounded-full shadow-xs uppercase tracking-wider">
                🥇 1st Champion
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank1.registrationId}:${winnerPhotos[rank1.registrationId] || ''}`}
                  rank={rank1}
                  photoUrl={winnerPhotos[rank1.registrationId]}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-4 border-[#FDBF0F] shadow-md bg-[#FFF1BD] mb-3"
                />

                <h3 className="public-card-title text-sm font-extrabold leading-tight">{rank1.candidateName}</h3>
                <span className="public-muted text-[11px] font-mono font-bold">{rank1.bib}</span>
                <div className="public-accent-text mt-1 text-[11px] font-semibold">
                  {rank1.teamName} ({rank1.teamCode})
                </div>
              </div>

              <div className="public-winner-stats mt-5 pt-3 border-t grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="public-muted text-[9px] uppercase font-bold block">Official Grade</span>
                  <span className="public-accent-text text-base font-black">Grade {rank1.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="public-muted text-[9px] uppercase font-bold block">Points Awarded</span>
                  <span className="public-points-text text-[13px] font-extrabold">+{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' · Team' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2nd Place - Silver */}
          {rank2 && (
            <div className="public-winner-card public-winner-second md:order-1 rounded-2xl border p-4 sm:p-5 shadow-xs text-center flex flex-col justify-between">
              <div className="public-winner-label public-winner-label-second inline-block mx-auto text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                🥈 2nd Place
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank2.registrationId}:${winnerPhotos[rank2.registrationId] || ''}`}
                  rank={rank2}
                  photoUrl={winnerPhotos[rank2.registrationId]}
                  className="w-14 h-14 rounded-full border-4 border-[#D8C8B7] shadow-xs bg-[#F4EDE3] mb-3"
                />

                <h3 className="public-card-title text-[13px] font-bold leading-tight">{rank2.candidateName}</h3>
                <span className="public-muted text-[11px] font-mono font-semibold">{rank2.bib}</span>
                <div className="public-muted mt-1 text-[11px] font-semibold">
                  {rank2.teamName} ({rank2.teamCode})
                </div>
              </div>

              <div className="public-winner-stats mt-5 pt-3 border-t grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="public-muted text-[9px] uppercase font-bold block">Official Grade</span>
                  <span className="public-accent-text text-sm font-black">Grade {rank2.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="public-muted text-[9px] uppercase font-bold block">Points Awarded</span>
                  <span className="public-points-text text-xs font-extrabold">+{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' · Team' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place - Bronze */}
          {rank3 && (
            <div className="public-winner-card public-winner-third md:order-3 rounded-2xl border p-4 sm:p-5 shadow-xs text-center flex flex-col justify-between">
              <div className="public-winner-label public-winner-label-third inline-block mx-auto text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                🥉 3rd Place
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank3.registrationId}:${winnerPhotos[rank3.registrationId] || ''}`}
                  rank={rank3}
                  photoUrl={winnerPhotos[rank3.registrationId]}
                  className="w-14 h-14 rounded-full border-4 border-[#D7B68A] shadow-xs bg-[#F5E6D0] mb-3"
                />

                <h3 className="public-card-title text-[13px] font-bold leading-tight">{rank3.candidateName}</h3>
                <span className="public-muted text-[11px] font-mono font-semibold">{rank3.bib}</span>
                <div className="public-muted mt-1 text-[11px] font-semibold">
                  {rank3.teamName} ({rank3.teamCode})
                </div>
              </div>

              <div className="public-winner-stats mt-5 pt-3 border-t grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="public-muted text-[9px] uppercase font-bold block">Official Grade</span>
                  <span className="public-accent-text text-sm font-black">Grade {rank3.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="public-muted text-[9px] uppercase font-bold block">Points Awarded</span>
                  <span className="public-points-text text-xs font-extrabold">+{rank3.officialPoints ?? rank3.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' · Team' : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Complete Tabulation Register Table */}
      <section className="public-table-card rounded-2xl border shadow-xs overflow-hidden">
        <div className="public-card-header px-4 sm:px-5 py-3.5 border-b flex items-center justify-between gap-3">
          <h3 className="public-card-title text-sm font-bold">Full Contestant Tabulation Sheet</h3>
          <span className="public-muted text-[10px]">{result.ranks.length} Evaluated Participants</span>
        </div>

        <div className="overflow-x-auto">
          <table className="public-table w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="public-table-head border-b font-bold uppercase text-[10px]">
                <th className="py-3 px-6">Placing Rank</th>
                <th className="py-3 px-6">Candidate / Ensemble</th>
                <th className="py-3 px-6">Bib #</th>
                <th className="py-3 px-6">Contingent Delegation</th>
                <th className="py-3 px-6 text-center">Grade</th>
                <th className="py-3 px-6 text-right">Points Accredited</th>
              </tr>
            </thead>
            <tbody className="public-table-body divide-y">
              {result.ranks.map(rk => (
                <tr key={rk.registrationId} className="public-table-row">
                  <td className="py-3 px-4 font-bold text-[#111111]">
                    {rk.rank === 1 && <span className="text-amber-600 font-extrabold">🥇 1st Place</span>}
                    {rk.rank === 2 && <span className="text-slate-600 font-extrabold">🥈 2nd Place</span>}
                    {rk.rank === 3 && <span className="text-amber-800 font-extrabold">🥉 3rd Place</span>}
                    {!rk.rank && <span className="text-[#526070]">Participated</span>}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#111111]">
                    {rk.candidateName}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#526070]">
                    {rk.bib}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-[#111111]">{rk.teamName}</span> ({rk.teamCode})
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="public-grade-pill font-bold px-2 py-0.5 rounded border">
                      Grade {rk.grade}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                    +{rk.officialPoints ?? rk.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' (Team only)' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="poster-download-heading" className="public-poster-cta scroll-mt-24 rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="poster-download-heading" className="public-card-title flex items-center gap-2 text-sm sm:text-base font-bold">
              <Download className="h-4 w-4 text-[#FDBF0F]" />
              Download a Result Poster
            </h2>
            <p className="public-muted mt-1 text-xs">
              Choose from templates released by the festival. Each template can be used with every published competition result.
            </p>
          </div>
          <Link href={`/public/posters?resultId=${encodeURIComponent(result.id)}`} className="public-primary-button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold">
            Choose Poster Template <Download className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function PublicCompetitionDetailPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="public-empty-state p-10 text-center text-xs">Loading competition result...</div>}>
        <CompetitionDetailContent />
      </Suspense>
    </PublicLayout>
  );
}
