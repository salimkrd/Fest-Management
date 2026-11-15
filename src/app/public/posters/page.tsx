'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ImageIcon,
  LoaderCircle,
  Palette,
  ShieldCheck,
  Smartphone,
  Square,
  FileText
} from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ResultPosterPreview } from '@/components/domain/ResultPosterPreview';
import type { PosterTemplate } from '@/types/fest';
import { exportPosterAsPng } from '@/utils/canvasExport';

function PublicPosterGalleryContent() {
  const searchParams = useSearchParams();
  const requestedResultId = searchParams.get('resultId') || '';
  const { results, theme } = useFest();
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedResultId, setSelectedResultId] = useState(requestedResultId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedId, setDownloadedId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const publishedResults = results
    .filter(result => result.resultStatus === 'PUBLISHED')
    .sort((a, b) => a.competitionName.localeCompare(b.competitionName));

  const selectedResult =
    publishedResults.find(result => result.id === selectedResultId) ||
    publishedResults.find(result => result.competitionId === selectedResultId) ||
    publishedResults[0];

  useEffect(() => {
    setSelectedResultId(requestedResultId);
  }, [requestedResultId]);

  useEffect(() => {
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
        if (active) setTemplates(items.filter(template => template.released === true));
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load poster templates.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleDownload(template: PosterTemplate) {
    if (!selectedResult) return;
    setDownloadingId(template.id);
    setDownloadedId(null);
    setDownloadError('');
    try {
      await exportPosterAsPng(selectedResult, theme, template.config, template.name);
      setDownloadedId(template.id);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The poster could not be downloaded. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <PublicLayout>
      <div className="public-page-stack mx-auto max-w-7xl space-y-8">
        {/* EDITORIAL HERO BANNER */}
        <section className="relative w-full rounded-2xl bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] p-6 sm:p-10 border border-[#BA1912]/30 shadow-2xl overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-[#BA1912]/20 blur-[100px] rounded-full" />
          <div className="pointer-events-none absolute top-10 right-10 w-64 h-64 bg-[#FDBF0F]/10 blur-[80px] rounded-full" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <Link
                href="/public/directory"
                className="inline-flex items-center gap-1.5 text-xs text-[#FDBF0F] hover:underline font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Ratified Results Directory</span>
              </Link>

              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#FDBF0F]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F]">
                  Official Media Studio &amp; Folio Hub
                </span>
              </div>

              <h1
                className="text-2xl sm:text-4xl font-extrabold uppercase tracking-wide text-[#F2F3E6]"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Commemorative Result Posters
              </h1>

              <p className="text-xs sm:text-sm text-[#F2F3E6]/75 max-w-2xl leading-relaxed">
                Choose any officially ratified competition result, preview released design templates, and export high-resolution assets suitable for print gazettes, status stories, and social circulation.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto px-4 py-2 rounded-xl bg-[#1B090B] border border-[#FDBF0F]/30 text-[#FDBF0F] text-xs font-mono">
              <ShieldCheck className="w-4 h-4 text-[#FDBF0F]" />
              <span>Lossless PNG Generation</span>
            </div>
          </div>
        </section>

        {/* COMPETITION RESULT SELECTOR PANEL */}
        <section className="w-full bg-[#230D0F] rounded-2xl border border-[#BA1912]/30 p-5 sm:p-6 shadow-xl space-y-3">
          <label htmlFor="poster-result-select" className="text-xs uppercase tracking-wider font-bold text-[#FDBF0F] block">
            Select Competition Result to Render
          </label>
          <div className="relative max-w-3xl">
            <select
              id="poster-result-select"
              value={selectedResult?.id || ''}
              onChange={event => {
                setSelectedResultId(event.target.value);
                setDownloadedId(null);
                setDownloadError('');
              }}
              disabled={publishedResults.length === 0}
              className="w-full rounded-xl bg-[#1B090B] px-4 py-3 text-xs sm:text-sm text-[#F2F3E6] border border-[#BA1912]/40 focus:border-[#FDBF0F] focus:outline-none appearance-none cursor-pointer"
            >
              {publishedResults.length === 0 ? (
                <option value="">No published results available yet</option>
              ) : (
                publishedResults.map(result => (
                  <option key={result.id} value={result.id}>
                    #{result.competitionCode} · {result.competitionName} ({result.categoryName} Division)
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedResult && (
            <p className="text-[11px] text-[#F2F3E6]/70 leading-relaxed">
              Active Selection: <strong className="text-[#FDBF0F]">{selectedResult.competitionName}</strong> (#{selectedResult.competitionCode}). Laureates are dynamically populated onto templates. Raw scores and marks are never exposed on public posters.
            </p>
          )}
        </section>

        {/* TEMPLATES GRID HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FDBF0F] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FDBF0F]">
                Design Folio Catalog
              </span>
            </div>
            <h2
              className="text-lg sm:text-xl font-bold uppercase text-[#F2F3E6] mt-0.5"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Released Poster Templates
            </h2>
          </div>
          <span className="text-xs text-[#F2F3E6]/70 font-mono bg-[#230D0F] px-3 py-1.5 rounded-lg border border-white/5">
            {loading ? 'Scanning catalog…' : `${templates.length} ${templates.length === 1 ? 'Design' : 'Designs'} Available`}
          </span>
        </div>

        {/* TEMPLATES CONTENT */}
        {loading ? (
          <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-[#BA1912]/30 text-xs text-[#F2F3E6]/70">
            <LoaderCircle className="w-6 h-6 text-[#FDBF0F] animate-spin mx-auto mb-2" />
            Loading released poster templates…
          </div>
        ) : loadError ? (
          <div role="alert" className="p-4 rounded-xl bg-[#2D1217] border border-red-500/40 text-xs text-red-200">
            {loadError}
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#230D0F] border border-dashed border-[#BA1912]/40">
            <ImageIcon className="w-10 h-10 text-[#FDBF0F]/50 mx-auto mb-3" />
            <h3
              className="text-base font-bold uppercase text-[#F2F3E6]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              No Templates Released Yet
            </h3>
            <p className="mt-2 text-xs text-[#F2F3E6]/70 max-w-md mx-auto leading-relaxed">
              The festival media team has not released any reusable poster templates yet. Please check again after a template is released in Media Studio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <article
                key={template.id}
                className="flex flex-col bg-[#230D0F] hover:bg-[#281014] rounded-2xl border border-[#BA1912]/30 hover:border-[#BA1912]/60 p-4 sm:p-5 shadow-xl transition-all justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#F2F3E6] truncate">{template.name}</h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#F2F3E6]/60 mt-0.5">
                        {template.config.aspectRatio === '9:16' ? (
                          <Smartphone className="w-3 h-3 text-[#FDBF0F]" />
                        ) : template.config.aspectRatio === '4:5' ? (
                          <FileText className="w-3 h-3 text-[#FDBF0F]" />
                        ) : (
                          <Square className="w-3 h-3 text-[#FDBF0F]" />
                        )}
                        <span className="font-mono">{template.config.aspectRatio} Ratio</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#1B090B] text-[#FDBF0F] border border-[#FDBF0F]/30 shrink-0">
                      Released
                    </span>
                  </div>

                  {selectedResult && (
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#120507] p-2 shadow-inner">
                      <ResultPosterPreview
                        result={selectedResult}
                        theme={theme}
                        config={template.config}
                        className="w-full overflow-hidden rounded-lg shadow-md"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#BA1912]/20 space-y-2">
                  <button
                    type="button"
                    disabled={Boolean(downloadingId) || !selectedResult}
                    onClick={() => void handleDownload(template)}
                    className="w-full py-2.5 rounded-lg bg-[#BA1912] hover:bg-[#A91D3A] text-[#F2F3E6] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingId === template.id ? (
                      <>
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#FDBF0F]" />
                        <span>Generating PNG…</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 text-[#FDBF0F]" />
                        <span>Download PNG</span>
                      </>
                    )}
                  </button>

                  {downloadedId === template.id && (
                    <div
                      role="status"
                      className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Poster saved to downloads</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {downloadError && (
          <div role="alert" className="p-3 rounded-xl bg-[#2D1217] border border-red-500/40 text-red-200 text-xs">
            {downloadError}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default function PublicPostersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1B090B] flex items-center justify-center text-xs text-[#F2F3E6]/70">
          <LoaderCircle className="h-6 w-6 animate-spin text-[#FDBF0F] mr-2" />
          Loading poster studio…
        </div>
      }
    >
      <PublicPosterGalleryContent />
    </Suspense>
  );
}
