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
      <div className="bg-white p-12 text-center rounded-2xl border border-[#E1E7EF]">
        <h2 className="text-lg font-bold text-[#111111]">Competition Result Not Found</h2>
        <p className="text-xs text-[#526070] mt-1">This competition result may not be published yet.</p>
        <Link href="/public" className="mt-4 inline-block text-xs font-bold text-[#2563EB]">
          ← Return to Results Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back Link & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/public"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#526070] hover:text-[#111111] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Results</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            onClick={handleShare}
          >
            {copied ? 'Link Copied' : 'Share Link'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleWhatsAppShare}
          >
            WhatsApp
          </Button>
        </div>
      </div>

      {shareError && <p role="alert" className="text-sm text-red-700">{shareError}</p>}

      {/* Event Header Banner */}
      <div className="bg-white rounded-3xl border border-[#E1E7EF] p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {result.competitionCode}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#526070]">
                {result.categoryName} Division · {result.type} Contest
              </span>
              <Badge variant="success" size="sm" dot>OFFICIALLY PUBLISHED</Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
              {result.competitionName}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#526070]">
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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            The Laureates Podium
          </h2>
          <span className="text-xs text-[#526070]">Verified Adjudicated Placings</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1st Place - Gold (Elevated) */}
          {rank1 && (
            <div className="md:order-2 bg-gradient-to-b from-amber-50/80 to-white rounded-2xl border-2 border-amber-300 p-6 shadow-md text-center relative flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-neutral-900 text-xs font-black px-3 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                🥇 1st Champion
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank1.registrationId}:${winnerPhotos[rank1.registrationId] || ''}`}
                  rank={rank1}
                  photoUrl={winnerPhotos[rank1.registrationId]}
                  className="w-20 h-20 rounded-full border-4 border-amber-300 shadow-md bg-amber-100 mb-3"
                />

                <h3 className="text-base font-extrabold text-[#111111] leading-tight">{rank1.candidateName}</h3>
                <span className="text-xs font-mono font-bold text-[#526070]">{rank1.bib}</span>
                <div className="mt-1 text-xs font-semibold text-[#2563EB]">
                  {rank1.teamName} ({rank1.teamCode})
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-amber-200/80 grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Official Grade</span>
                  <span className="text-lg font-black text-[#2563EB]">Grade {rank1.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Points Awarded</span>
                  <span className="text-lg font-extrabold text-emerald-700">+{rank1.officialPoints ?? rank1.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' · Team' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2nd Place - Silver */}
          {rank2 && (
            <div className="md:order-1 bg-white rounded-2xl border border-slate-300 p-6 shadow-xs text-center flex flex-col justify-between">
              <div className="inline-block mx-auto bg-slate-200 text-slate-800 text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-2">
                🥈 2nd Place
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank2.registrationId}:${winnerPhotos[rank2.registrationId] || ''}`}
                  rank={rank2}
                  photoUrl={winnerPhotos[rank2.registrationId]}
                  className="w-16 h-16 rounded-full border-4 border-slate-200 shadow-xs bg-slate-100 mb-3"
                />

                <h3 className="text-sm font-bold text-[#111111] leading-tight">{rank2.candidateName}</h3>
                <span className="text-xs font-mono font-semibold text-[#526070]">{rank2.bib}</span>
                <div className="mt-1 text-xs font-semibold text-[#526070]">
                  {rank2.teamName} ({rank2.teamCode})
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E1E7EF] grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Official Grade</span>
                  <span className="text-base font-black text-[#2563EB]">Grade {rank2.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Points Awarded</span>
                  <span className="text-base font-extrabold text-emerald-700">+{rank2.officialPoints ?? rank2.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' · Team' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place - Bronze */}
          {rank3 && (
            <div className="md:order-3 bg-white rounded-2xl border border-amber-200 p-6 shadow-xs text-center flex flex-col justify-between">
              <div className="inline-block mx-auto bg-amber-100 text-amber-900 text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-2">
                🥉 3rd Place
              </div>

              <div className="pt-2">
                <WinnerPhoto
                  key={`${rank3.registrationId}:${winnerPhotos[rank3.registrationId] || ''}`}
                  rank={rank3}
                  photoUrl={winnerPhotos[rank3.registrationId]}
                  className="w-16 h-16 rounded-full border-4 border-amber-100 shadow-xs bg-amber-50 mb-3"
                />

                <h3 className="text-sm font-bold text-[#111111] leading-tight">{rank3.candidateName}</h3>
                <span className="text-xs font-mono font-semibold text-[#526070]">{rank3.bib}</span>
                <div className="mt-1 text-xs font-semibold text-[#526070]">
                  {rank3.teamName} ({rank3.teamCode})
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E1E7EF] grid grid-cols-2 gap-3">
                <div className="text-left">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Official Grade</span>
                  <span className="text-base font-black text-[#2563EB]">Grade {rank3.grade || '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Points Awarded</span>
                  <span className="text-base font-extrabold text-emerald-700">+{rank3.officialPoints ?? rank3.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' · Team' : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Complete Tabulation Register Table */}
      <section className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E1E7EF] bg-white flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111111]">Full Contestant Tabulation Sheet</h3>
          <span className="text-xs text-[#526070]">{result.ranks.length} Evaluated Participants</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E1E7EF] bg-[#F8FAFC] text-[#526070] font-bold uppercase text-[11px]">
                <th className="py-3 px-6">Placing Rank</th>
                <th className="py-3 px-6">Candidate / Ensemble</th>
                <th className="py-3 px-6">Bib #</th>
                <th className="py-3 px-6">Contingent Delegation</th>
                <th className="py-3 px-6 text-center">Grade</th>
                <th className="py-3 px-6 text-right">Points Accredited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E7EF]">
              {result.ranks.map(rk => (
                <tr key={rk.registrationId} className="hover:bg-[#F8FAFC]">
                  <td className="py-4 px-6 font-bold text-[#111111]">
                    {rk.rank === 1 && <span className="text-amber-600 font-extrabold">🥇 1st Place</span>}
                    {rk.rank === 2 && <span className="text-slate-600 font-extrabold">🥈 2nd Place</span>}
                    {rk.rank === 3 && <span className="text-amber-800 font-extrabold">🥉 3rd Place</span>}
                    {!rk.rank && <span className="text-[#526070]">Participated</span>}
                  </td>
                  <td className="py-4 px-6 font-bold text-[#111111]">
                    {rk.candidateName}
                  </td>
                  <td className="py-4 px-6 font-mono text-[#526070]">
                    {rk.bib}
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-semibold text-[#111111]">{rk.teamName}</span> ({rk.teamCode})
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Grade {rk.grade}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-emerald-600 text-sm">
                    +{rk.officialPoints ?? rk.totalEarnedPoints ?? 0} pts{result.type === 'GROUP' ? ' (Team only)' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="poster-download-heading" className="scroll-mt-24 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="poster-download-heading" className="flex items-center gap-2 text-base font-bold text-[#111111]">
              <Download className="h-4 w-4 text-[#2563EB]" />
              Download a Result Poster
            </h2>
            <p className="mt-1 text-sm text-[#526070]">
              Choose from templates released by the festival. Each template can be used with every published competition result.
            </p>
          </div>
          <Link href={`/public/posters?resultId=${encodeURIComponent(result.id)}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8]">
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
      <Suspense fallback={<div className="p-12 text-center text-xs text-[#526070]">Loading competition result...</div>}>
        <CompetitionDetailContent />
      </Suspense>
    </PublicLayout>
  );
}
