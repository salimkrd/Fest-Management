'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Trophy,
  Award,
  Medal,
  Download,
  Share2,
  ArrowLeft,
  Check,
  Sparkles,
  Calendar,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { exportPosterAsPng } from '@/utils/canvasExport';

function CompetitionDetailContent() {
  const params = useParams();
  const compId = params?.id as string;
  const { results, competitions, theme } = useFest();

  const [copied, setCopied] = useState(false);

  // Find result for this competition
  const result = results.find(r => r.competitionId === compId || r.id === compId) || results[0];
  const competition = competitions.find(c => c.id === result?.competitionId) || competitions[0];

  const rank1 = result?.ranks.find(r => r.rank === 1);
  const rank2 = result?.ranks.find(r => r.rank === 2);
  const rank3 = result?.ranks.find(r => r.rank === 3);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
      <div className="flex items-center justify-between">
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

      {/* Event Header Banner */}
      <div className="bg-white rounded-3xl border border-[#E1E7EF] p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
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
                <div className="w-20 h-20 rounded-full border-4 border-amber-300 mx-auto shadow-md overflow-hidden bg-amber-100 mb-3">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
                    alt={rank1.candidateName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-base font-extrabold text-[#111111] leading-tight">{rank1.candidateName}</h3>
                <span className="text-xs font-mono font-bold text-[#526070]">{rank1.bib}</span>
                <div className="mt-1 text-xs font-semibold text-[#2563EB]">
                  {rank1.teamName} ({rank1.teamCode})
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-amber-200/80 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Adjudicated Score</span>
                  <span className="text-xl font-black text-[#111111]">{rank1.score} <span className="text-xs font-normal text-[#526070]">/ 100</span></span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 block">Grade {rank1.grade}</span>
                  <span className="text-xs font-extrabold text-amber-700">+{rank1.totalEarnedPoints} pts</span>
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
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 mx-auto shadow-xs overflow-hidden bg-slate-100 mb-3">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
                    alt={rank2.candidateName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-sm font-bold text-[#111111] leading-tight">{rank2.candidateName}</h3>
                <span className="text-xs font-mono font-semibold text-[#526070]">{rank2.bib}</span>
                <div className="mt-1 text-xs font-semibold text-[#526070]">
                  {rank2.teamName} ({rank2.teamCode})
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Score</span>
                  <span className="text-lg font-black text-[#111111]">{rank2.score}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 block">Grade {rank2.grade}</span>
                  <span className="text-xs font-extrabold text-[#2563EB]">+{rank2.totalEarnedPoints} pts</span>
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
                <div className="w-16 h-16 rounded-full border-4 border-amber-100 mx-auto shadow-xs overflow-hidden bg-amber-50 mb-3">
                  <img
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
                    alt={rank3.candidateName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-sm font-bold text-[#111111] leading-tight">{rank3.candidateName}</h3>
                <span className="text-xs font-mono font-semibold text-[#526070]">{rank3.bib}</span>
                <div className="mt-1 text-xs font-semibold text-[#526070]">
                  {rank3.teamName} ({rank3.teamCode})
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] text-[#526070] uppercase font-bold block">Score</span>
                  <span className="text-lg font-black text-[#111111]">{rank3.score}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 block">Grade {rank3.grade}</span>
                  <span className="text-xs font-extrabold text-[#2563EB]">+{rank3.totalEarnedPoints} pts</span>
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
                <th className="py-3 px-6 text-center">Adjudicated Score</th>
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
                  <td className="py-4 px-6 text-center font-black text-sm text-[#111111]">
                    {rk.score}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Grade {rk.grade}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-emerald-600 text-sm">
                    +{rk.totalEarnedPoints} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Media Studio Released Poster Showcase */}
      {result.posterReleased && (
        <section className="bg-white rounded-3xl border border-[#E1E7EF] p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111111] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Media Studio Official Poster
              </h3>
              <p className="text-xs text-[#526070]">
                Official high-resolution graphic release for sharing across digital platforms
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => exportPosterAsPng(result, theme, result.posterConfig)}
            >
              Download Poster (PNG)
            </Button>
          </div>

          {/* Poster Preview */}
          <div className="flex justify-center">
            <div className="w-full max-w-md bg-gradient-to-b from-[#1E3A8A] via-[#1D4ED8] to-[#172554] rounded-2xl p-6 text-white shadow-xl flex flex-col justify-between border border-blue-400/30">
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-widest text-white/70 font-bold block">
                  {theme.festivalName.toUpperCase()} · OFFICIAL RESULT
                </span>
                <h2 className="text-lg font-black tracking-tight mt-1 text-white">
                  {result.competitionName}
                </h2>
                <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                  {result.categoryName} · {result.type}
                </span>
              </div>

              <div className="my-6 space-y-3">
                {rank1 && (
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-amber-400 text-neutral-900 font-black text-xs flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-white">{rank1.candidateName}</h4>
                        <p className="text-[10px] text-white/70">{rank1.teamName} ({rank1.teamCode})</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-amber-300 block">{rank1.score} PTS</span>
                      <span className="text-[9px] text-white/60">GRADE {rank1.grade}</span>
                    </div>
                  </div>
                )}

                {rank2 && (
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2.5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-300 text-neutral-900 font-black text-[10px] flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div>
                        <h4 className="text-xs font-medium text-white">{rank2.candidateName}</h4>
                        <p className="text-[9px] text-white/60">{rank2.teamName}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white/80">{rank2.score} PTS</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/60">
                <span>{theme.institutionName}</span>
                <span className="font-mono">VERIFIED RESULT</span>
              </div>
            </div>
          </div>
        </section>
      )}
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
