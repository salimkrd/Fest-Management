'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  X,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Square,
  FileText
} from 'lucide-react';
import type { CompetitionResult, PosterTemplate, PublicThemeSettings } from '@/types/fest';
import { ResultPosterPreview } from '@/components/domain/ResultPosterPreview';
import { exportPosterAsPng } from '@/utils/canvasExport';

interface PosterDownloadDialogProps {
  result: CompetitionResult;
  theme: PublicThemeSettings;
}

export function PosterDownloadDialog({ result, theme }: PosterDownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedId, setDownloadedId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || templates.length > 0 || loading) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    fetch('/api/posters/public-templates', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load released poster templates.');
        return Array.isArray(payload.templates) ? (payload.templates as PosterTemplate[]) : [];
      })
      .then(items => {
        if (active) {
          const released = items.filter(template => template.released === true);
          setTemplates(released);
          if (released.length > 0) {
            setSelectedTemplateId(released[0].id);
          }
        }
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load released poster templates.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, templates.length, loading]);

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  async function downloadPoster(template: PosterTemplate) {
    setDownloadingId(template.id);
    setDownloadedId(null);
    setDownloadError('');
    try {
      await exportPosterAsPng(result, theme, template.config, template.name);
      setDownloadedId(template.id);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The poster could not be downloaded. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  const handleWhatsAppCirculate = () => {
    if (typeof window !== 'undefined') {
      const rank1 = result.ranks.find(r => r.rank === 1);
      const text = encodeURIComponent(
        `*${theme.festivalName || 'INSPIRAATH'} — Official Event Poster*\n🏆 *${result.competitionName}* (${result.categoryName})\n🥇 1st Place: ${rank1?.candidateName || 'N/A'}\n\nDownload high-res commemorative poster: ${window.location.origin}/public/competition/${encodeURIComponent(result.competitionId)}`
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Download a poster for ${result.competitionName}`}
        className="px-3 py-2 bg-[#230D0F] hover:bg-[#281014] text-[#F2F3E6] text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 border border-[#BA1912]/40 transition-colors shadow-sm"
      >
        <Download className="w-3.5 h-3.5 text-[#FDBF0F]" />
        <span>Poster</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !downloadingId) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`poster-dialog-title-${result.id}`}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#1B090B] border border-[#BA1912]/40 shadow-2xl text-[#F2F3E6]"
          >
            {/* Dialog Header matching Stitch */}
            <header className="flex items-start justify-between gap-4 border-b border-[#BA1912]/30 px-5 py-4 bg-[#230D0F]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F]">
                    Media Studio Asset Pipeline
                  </span>
                </div>
                <h2
                  id={`poster-dialog-title-${result.id}`}
                  className="text-base sm:text-lg font-bold uppercase tracking-wide text-[#F2F3E6]"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Download Ratified Event Poster &amp; Gazette
                </h2>
                <p className="text-xs text-[#F2F3E6]/70 mt-0.5">
                  #{result.competitionCode} · {result.competitionName} · {result.categoryName} Division
                </p>
              </div>

              <button
                type="button"
                aria-label="Close poster dialog"
                onClick={() => setOpen(false)}
                disabled={Boolean(downloadingId)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B090B] hover:bg-[#281014] text-[#F2F3E6] border border-[#BA1912]/30 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Dialog Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {loading ? (
                <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-xs text-[#F2F3E6]/70">
                  <LoaderCircle className="h-6 w-6 animate-spin text-[#FDBF0F]" />
                  <span>Loading released poster templates…</span>
                </div>
              ) : loadError ? (
                <div role="alert" className="rounded-xl bg-[#2D1217] border border-red-500/40 p-4 text-xs text-red-200">
                  {loadError}
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#BA1912]/40 bg-[#230D0F] p-8 sm:p-12 text-center">
                  <ImageIcon className="mx-auto mb-3 h-10 w-10 text-[#FDBF0F]/60" />
                  <h3
                    className="text-base font-bold uppercase text-[#F2F3E6]"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    No Posters Released Yet
                  </h3>
                  <p className="mt-2 text-xs text-[#F2F3E6]/70 max-w-md mx-auto leading-relaxed">
                    The festival committee has not released an official template for this event yet. Once released in Media Studio, it will appear here instantly.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Active Preview */}
                  <div className="lg:col-span-7 flex flex-col items-center">
                    <div className="w-full max-w-md rounded-2xl bg-[#120507] p-3 sm:p-4 border border-[#BA1912]/40 shadow-xl relative">
                      <div className="flex items-center justify-between mb-2 px-1 text-[11px] text-[#FDBF0F] font-mono">
                        <span className="flex items-center gap-1.5 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#FDBF0F]" />
                          Official Ratified Render
                        </span>
                        <span className="uppercase text-[#F2F3E6]/60 text-[10px]">
                          {activeTemplate?.config.aspectRatio || '1:1'} Format
                        </span>
                      </div>

                      {activeTemplate && (
                        <ResultPosterPreview
                          result={result}
                          theme={theme}
                          config={activeTemplate.config}
                          className="w-full overflow-hidden rounded-xl border border-white/10 shadow-2xl"
                        />
                      )}
                    </div>
                  </div>

                  {/* Right Column: Templates Selection & Export Actions */}
                  <div className="lg:col-span-5 space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F] block mb-1">
                        Select Layout &amp; Template
                      </span>
                      <h4 className="text-sm font-bold text-[#F2F3E6]">
                        {templates.length} Released {templates.length === 1 ? 'Design' : 'Designs'} Available
                      </h4>
                    </div>

                    {/* Template Selection Pills */}
                    <div className="space-y-2">
                      {templates.map(tmpl => {
                        const isSelected = tmpl.id === (activeTemplate?.id || '');
                        return (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => setSelectedTemplateId(tmpl.id)}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-[#230D0F] border-[#FDBF0F] shadow-md shadow-[#FDBF0F]/10'
                                : 'bg-[#1B090B] border-white/10 hover:border-[#BA1912]/50 hover:bg-[#230D0F]/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-[#FDBF0F] text-[#1B090B]' : 'bg-[#230D0F] text-[#F2F3E6]/60'
                                }`}
                              >
                                {tmpl.config.aspectRatio === '9:16' ? (
                                  <Smartphone className="w-4 h-4" />
                                ) : tmpl.config.aspectRatio === '4:5' ? (
                                  <FileText className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-[#F2F3E6] truncate">{tmpl.name}</h5>
                                <p className="text-[10px] text-[#F2F3E6]/60 font-mono">
                                  {tmpl.config.aspectRatio} Aspect Ratio
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                isSelected ? 'bg-[#FDBF0F] text-[#1B090B]' : 'bg-[#230D0F] text-[#FDBF0F]'
                              }`}
                            >
                              Released
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Download Button */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        disabled={Boolean(downloadingId) || !activeTemplate}
                        onClick={() => activeTemplate && void downloadPoster(activeTemplate)}
                        className="w-full py-3 rounded-xl bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#BA1912]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingId === activeTemplate?.id ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin text-[#FDBF0F]" />
                            <span>Exporting High-Res PNG…</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 text-[#FDBF0F]" />
                            <span>Download Poster Asset (PNG)</span>
                          </>
                        )}
                      </button>

                      {downloadedId === activeTemplate?.id && (
                        <div
                          role="status"
                          className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Lossless PNG successfully saved to your downloads</span>
                        </div>
                      )}

                      {/* WhatsApp Circulation Button */}
                      <button
                        type="button"
                        onClick={handleWhatsAppCirculate}
                        className="w-full py-2.5 rounded-xl bg-[#1B090B] hover:bg-[#230D0F] text-[#FDBF0F] text-xs font-semibold border border-[#FDBF0F]/30 flex items-center justify-center gap-2 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Circulate on WhatsApp</span>
                      </button>
                    </div>

                    {downloadError && (
                      <div role="alert" className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs">
                        {downloadError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <footer className="flex items-center justify-between border-t border-[#BA1912]/30 px-5 py-3 bg-[#230D0F]">
              <span className="text-[10px] text-[#F2F3E6]/60 font-mono">
                Sanctified under Central Directorate • Lossless Export
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={Boolean(downloadingId)}
                className="px-4 py-1.5 rounded-lg bg-[#1B090B] hover:bg-[#281014] text-[#F2F3E6] text-xs font-semibold border border-white/10 transition-colors disabled:opacity-50"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
