'use client';

import React, { useState } from 'react';
import { CompetitionResult, PosterConfig } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Download, Globe, CheckCircle2, Sparkles } from 'lucide-react';
import { useFest } from '@/context/FestContext';
import { exportPosterAsPng } from '@/utils/canvasExport';

interface PosterStudioModalProps {
  result: CompetitionResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PosterStudioModal: React.FC<PosterStudioModalProps> = ({
  result,
  isOpen,
  onClose
}) => {
  const { updatePosterConfig, theme } = useFest();

  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16'>(result?.posterConfig?.aspectRatio || '1:1');
  const [colorPreset, setColorPreset] = useState<'royal' | 'crimson' | 'emerald' | 'monochrome'>(result?.posterConfig?.colorPreset || 'royal');
  const [isReleased, setIsReleased] = useState<boolean>(result?.posterReleased || false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!result) return null;

  const handleSaveAndRelease = (releaseStatus: boolean) => {
    const config: PosterConfig = {
      aspectRatio,
      colorPreset,
      fontFamily: 'Montserrat',
      fontSize: 'standard',
      fontWeight: '700'
    };
    updatePosterConfig(result.id, config, releaseStatus);
    setIsReleased(releaseStatus);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const paletteStyles = {
    royal: {
      bg: 'bg-gradient-to-b from-[#1E3A8A] via-[#1D4ED8] to-[#172554]',
      accent: 'text-amber-400',
      badge: 'bg-amber-400 text-neutral-900',
      border: 'border-blue-400/30'
    },
    crimson: {
      bg: 'bg-gradient-to-b from-[#7F1D1D] via-[#991B1B] to-[#450A0A]',
      accent: 'text-yellow-400',
      badge: 'bg-yellow-400 text-neutral-900',
      border: 'border-red-400/30'
    },
    emerald: {
      bg: 'bg-gradient-to-b from-[#064E3B] via-[#047857] to-[#022C22]',
      accent: 'text-emerald-300',
      badge: 'bg-emerald-300 text-neutral-900',
      border: 'border-emerald-400/30'
    },
    monochrome: {
      bg: 'bg-gradient-to-b from-[#18181B] via-[#27272A] to-[#09090B]',
      accent: 'text-white',
      badge: 'bg-white text-neutral-900',
      border: 'border-neutral-700'
    }
  };

  const ratioSizes = {
    '1:1': 'w-[360px] h-[360px]',
    '4:5': 'w-[320px] h-[400px]',
    '9:16': 'w-[280px] h-[480px]'
  };

  const currentTheme = paletteStyles[colorPreset];
  const rank1 = result.ranks.find(r => r.rank === 1);
  const rank2 = result.ranks.find(r => r.rank === 2);
  const rank3 = result.ranks.find(r => r.rank === 3);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Media Poster Studio"
      description="Design and release official result celebration posters for social media and website"
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Poster updated &amp; saved!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => exportPosterAsPng(result, theme, { aspectRatio, colorPreset, fontFamily: 'Montserrat', fontSize: 'standard', fontWeight: '700' })}
            >
              Download PNG
            </Button>
            <Button
              variant={isReleased ? 'destructive' : 'primary'}
              size="sm"
              leftIcon={<Globe className="w-4 h-4" />}
              onClick={() => handleSaveAndRelease(!isReleased)}
            >
              {isReleased ? 'Revoke From Public' : 'Release to Public Site'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-2">
              Target Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['1:1', '4:5', '9:16'] as const).map(ratio => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${aspectRatio === ratio ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]' : 'border-[#E1E7EF] bg-white text-[#526070] hover:bg-[#F8FAFC]'}`}
                >
                  {ratio === '1:1' ? '1:1 Square' : ratio === '4:5' ? '4:5 Portrait' : '9:16 Story'}
                </button>
              ))}
            </div>
          </div>

          {/* Color Preset */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-2">
              Color Palette Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setColorPreset('royal')}
                className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${colorPreset === 'royal' ? 'border-[#2563EB] ring-2 ring-blue-100 bg-blue-50/50' : 'border-[#E1E7EF]'}`}
              >
                <span className="w-4 h-4 rounded-full bg-blue-700" />
                Royal Blue
              </button>
              <button
                type="button"
                onClick={() => setColorPreset('crimson')}
                className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${colorPreset === 'crimson' ? 'border-[#2563EB] ring-2 ring-blue-100 bg-blue-50/50' : 'border-[#E1E7EF]'}`}
              >
                <span className="w-4 h-4 rounded-full bg-red-800" />
                Crimson Gold
              </button>
              <button
                type="button"
                onClick={() => setColorPreset('emerald')}
                className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${colorPreset === 'emerald' ? 'border-[#2563EB] ring-2 ring-blue-100 bg-blue-50/50' : 'border-[#E1E7EF]'}`}
              >
                <span className="w-4 h-4 rounded-full bg-emerald-700" />
                Emerald Crest
              </button>
              <button
                type="button"
                onClick={() => setColorPreset('monochrome')}
                className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${colorPreset === 'monochrome' ? 'border-[#2563EB] ring-2 ring-blue-100 bg-blue-50/50' : 'border-[#E1E7EF]'}`}
              >
                <span className="w-4 h-4 rounded-full bg-neutral-900" />
                Monochrome
              </button>
            </div>
          </div>

          {/* Release Status Banner */}
          <div className="p-4 rounded-xl border border-[#E1E7EF] bg-[#F8FAFC]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111111]">Public Website Release</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isReleased ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}>
                {isReleased ? 'LIVE ON WEB' : 'DRAFT IN STUDIO'}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#526070]">
              When released, visitors can view and download this high-resolution official poster directly on the public result page.
            </p>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 bg-[#F8FAFC] rounded-2xl border border-[#E1E7EF] min-h-[460px]">
          <div className="flex items-center gap-1.5 text-xs text-[#526070] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Interactive Live Studio Canvas</span>
          </div>

          {/* Poster Element */}
          <div className={`${ratioSizes[aspectRatio]} ${currentTheme.bg} rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between border ${currentTheme.border} relative overflow-hidden transition-all duration-300`}>
            {/* Background vector accents */}
            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/5 blur-xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-white/5 blur-xl pointer-events-none" />

            {/* Poster Header */}
            <div className="text-center relative z-10">
              <span className="text-[9px] uppercase tracking-widest text-white/70 font-semibold block">
                SAHITHYOLSAV 2025 · OFFICIAL RESULT
              </span>
              <h2 className="text-base font-extrabold tracking-tight mt-0.5 text-white">
                {result.competitionName}
              </h2>
              <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 backdrop-blur-xs text-white/90">
                {result.categoryName} · {result.type}
              </span>
            </div>

            {/* Winners Section */}
            <div className="my-auto space-y-2.5 relative z-10">
              {/* 1st Place */}
              {rank1 && (
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-amber-400 text-neutral-900 font-extrabold text-xs flex items-center justify-center shrink-0">
                      1st
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{rank1.candidateName}</h4>
                      <p className="text-[10px] text-white/70">{rank1.teamName} ({rank1.teamCode})</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-amber-300 block">{rank1.score} PTS</span>
                    <span className="text-[9px] font-semibold text-white/60">GRADE {rank1.grade}</span>
                  </div>
                </div>
              )}

              {/* 2nd Place */}
              {rank2 && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2.5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-300 text-neutral-900 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                      2nd
                    </span>
                    <div>
                      <h4 className="text-xs font-medium text-white/95 leading-tight">{rank2.candidateName}</h4>
                      <p className="text-[9px] text-white/60">{rank2.teamName} ({rank2.teamCode})</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-white/90 block">{rank2.score} PTS</span>
                    <span className="text-[9px] text-white/50">GRADE {rank2.grade}</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {rank3 && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-extrabold text-[9px] flex items-center justify-center shrink-0">
                      3rd
                    </span>
                    <div>
                      <h4 className="text-[11px] font-medium text-white/90 leading-tight">{rank3.candidateName}</h4>
                      <p className="text-[9px] text-white/50">{rank3.teamName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-white/80 block">{rank3.score} PTS</span>
                    <span className="text-[8px] text-white/50">GRADE {rank3.grade}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Poster Footer */}
            <div className="text-center pt-2 border-t border-white/10 relative z-10 flex items-center justify-between text-[9px] text-white/60">
              <span>Markaz Knowledge City</span>
              <span className="font-mono">SEC-VERIFIED #2025</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
