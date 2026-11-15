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
  }, [open]);

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
        className="public-inline-link inline-flex items-center gap-1 text-xs font-bold"
      >
        <Download className="h-3.5 w-3.5" /> Download Poster
      </button>

      {open && (
        <div
          className="public-dialog-overlay fixed inset-0 z-[120] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={event => { if (event.target === event.currentTarget && !downloadingId) setOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`poster-dialog-title-${result.id}`}
            className="public-dialog flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-2xl"
          >
            <header className="public-dialog-header flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="public-eyebrow mb-1 text-[9px] font-bold uppercase tracking-[.16em]">Released by Media Studio</p>
                <h2 id={`poster-dialog-title-${result.id}`} className="public-dialog-title text-sm sm:text-base font-bold">Choose a Poster</h2>
                <p className="public-muted mt-1 text-[11px]">
                  {result.competitionName} · {result.categoryName} · {result.competitionCode}
                </p>
                <p className="public-muted mt-1 text-[10px]">Only templates released by the festival are shown. Choose a design to download this result as a PNG.</p>
              </div>
              <button
                type="button"
                aria-label="Close poster selection"
                onClick={() => setOpen(false)}
                disabled={Boolean(downloadingId)}
                className="public-dialog-close flex h-9 w-9 shrink-0 items-center justify-center rounded-full border disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="public-dialog-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {loading ? (
                <div className="public-muted flex min-h-40 items-center justify-center gap-2 text-xs">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Loading released posters…
                </div>
              ) : loadError ? (
                <div role="alert" className="public-alert rounded-xl border p-4 text-xs">{loadError}</div>
              ) : templates.length === 0 ? (
                <div className="public-empty-state rounded-xl border border-dashed px-6 py-10 text-center">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#C58B00]" />
                  <h3 className="public-card-title text-sm font-bold">No posters released yet</h3>
                  <p className="public-muted mt-1 text-xs leading-relaxed">The festival has not released a poster template. Once a template is released in Media Studio, it will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="public-card-title text-xs font-bold">Available poster templates</h3>
                    <span className="public-muted text-[10px] font-semibold">{templates.length} {templates.length === 1 ? 'poster' : 'posters'}</span>
                  </div>
                  <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                      <article key={template.id} className="public-dialog-template-card overflow-hidden rounded-xl border p-3 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="public-card-title break-words text-xs font-bold">{template.name}</h4>
                            <p className="public-muted mt-1 text-[10px]">{template.config.aspectRatio} · Reusable template</p>
                          </div>
                          <span className="public-released-badge shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase">Released</span>
                        </div>
                        <ResultPosterPreview
                          result={result}
                          theme={theme}
                          config={template.config}
                          className="public-poster-preview w-full overflow-hidden rounded-lg border"
                        />
                        <button
                          type="button"
                          disabled={Boolean(downloadingId)}
                          onClick={() => void downloadPoster(template)}
                          className="public-primary-button mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {downloadingId === template.id
                            ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Preparing PNG…</>
                            : <><Download className="h-3.5 w-3.5" /> Download Poster</>}
                        </button>
                        {downloadedId === template.id && (
                          <p role="status" className="public-success-note mt-2 flex items-center justify-center gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Download started
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}
              {downloadError && <p role="alert" className="public-alert mt-4 rounded-lg border p-3 text-xs">{downloadError}</p>}
            </div>
            <footer className="public-dialog-footer border-t px-4 py-3 text-right sm:px-5">
              <button type="button" onClick={() => setOpen(false)} disabled={Boolean(downloadingId)} className="public-dialog-close rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-50">
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
