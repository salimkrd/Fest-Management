'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Image as ImageIcon, LoaderCircle, X } from 'lucide-react';
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
        return Array.isArray(payload.templates) ? payload.templates as PosterTemplate[] : [];
      })
      .then(items => {
        if (active) setTemplates(items.filter(template => template.released === true));
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load released poster templates.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, templates.length, loading]);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Download a poster for ${result.competitionName}`}
        className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8]"
      >
        <Download className="h-3.5 w-3.5" /> Download Poster
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={event => { if (event.target === event.currentTarget && !downloadingId) setOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`poster-dialog-title-${result.id}`}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#F8FAFC] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#E1E7EF] bg-white px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[.16em] text-[#2563EB]">Released by Media Studio</p>
                <h2 id={`poster-dialog-title-${result.id}`} className="text-base font-bold text-[#111111] sm:text-lg">Choose a Poster</h2>
                <p className="mt-1 text-xs text-[#526070]">
                  {result.competitionName} · {result.categoryName} · {result.competitionCode}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">Only templates released by the festival are shown. Choose a design to download this result as a PNG.</p>
              </div>
              <button
                type="button"
                aria-label="Close poster selection"
                onClick={() => setOpen(false)}
                disabled={Boolean(downloadingId)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {loading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#526070]">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Loading released posters…
                </div>
              ) : loadError ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-6 py-12 text-center">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
                  <h3 className="text-sm font-bold text-[#111111]">No posters released yet</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#526070]">The festival has not released a poster template. Once a template is released in Media Studio, it will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#111111]">Available poster templates</h3>
                    <span className="text-[10px] font-semibold text-[#64748B]">{templates.length} {templates.length === 1 ? 'poster' : 'posters'}</span>
                  </div>
                  <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                      <article key={template.id} className="overflow-hidden rounded-xl border border-[#E1E7EF] bg-white p-3 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="break-words text-xs font-bold text-[#111111]">{template.name}</h4>
                            <p className="mt-1 text-[10px] text-[#64748B]">{template.config.aspectRatio} · Reusable template</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold uppercase text-emerald-700">Released</span>
                        </div>
                        <ResultPosterPreview
                          result={result}
                          theme={theme}
                          config={template.config}
                          className="w-full overflow-hidden rounded-lg border border-[#E1E7EF] bg-slate-50"
                        />
                        <button
                          type="button"
                          disabled={Boolean(downloadingId)}
                          onClick={() => void downloadPoster(template)}
                          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {downloadingId === template.id
                            ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Preparing PNG…</>
                            : <><Download className="h-3.5 w-3.5" /> Download Poster</>}
                        </button>
                        {downloadedId === template.id && (
                          <p role="status" className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Download started
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}
              {downloadError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{downloadError}</p>}
            </div>
            <footer className="border-t border-[#E1E7EF] bg-white px-4 py-3 text-right sm:px-6">
              <button type="button" onClick={() => setOpen(false)} disabled={Boolean(downloadingId)} className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-slate-50 disabled:opacity-50">
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
