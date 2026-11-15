'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download, ImageIcon, LoaderCircle, Palette } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useFest } from '@/context/FestContext';
import { ResultPosterPreview } from '@/components/domain/ResultPosterPreview';
import { Button } from '@/components/ui/Button';
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
  const selectedResult = publishedResults.find(result => result.id === selectedResultId)
    || publishedResults.find(result => result.competitionId === selectedResultId)
    || publishedResults[0];

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
        return Array.isArray(payload.templates) ? payload.templates as PosterTemplate[] : [];
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
    return () => { active = false; };
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
      <div className="public-page-stack mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/public" className="public-inline-link mb-4 inline-flex items-center gap-2 text-xs font-semibold hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to published results
          </Link>
          <div className="flex items-start gap-3">
            <div className="public-page-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <p className="public-eyebrow text-[10px] font-bold uppercase tracking-[.16em]">Official Media Studio</p>
              <h1 className="public-page-title mt-1 font-cinematic-editorial text-xl sm:text-2xl font-bold tracking-[0.1em]">Choose a Result Poster</h1>
              <p className="public-page-description mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed">
                Select a published competition, preview the templates released by the festival, and download your favourite design. Every released template works with every published result.
              </p>
            </div>
          </div>
        </div>

        <section className="public-filter-panel rounded-xl border p-4 sm:p-5">
          <label htmlFor="poster-result-select" className="public-card-title mb-2 block text-xs font-bold">Competition result</label>
          <select
            id="poster-result-select"
            value={selectedResult?.id || ''}
            onChange={event => {
              setSelectedResultId(event.target.value);
              setDownloadedId(null);
              setDownloadError('');
            }}
            disabled={publishedResults.length === 0}
            className="public-control w-full max-w-2xl rounded-lg px-3 py-2.5 text-xs outline-none"
          >
            {publishedResults.length === 0 ? (
              <option value="">No published results available yet</option>
            ) : publishedResults.map(result => (
              <option key={result.id} value={result.id}>
                {result.competitionCode} · {result.competitionName} · {result.categoryName}
              </option>
            ))}
          </select>
          {selectedResult && (
            <p className="public-muted mt-2 text-[11px]">
              Posters will use the published winners for <strong className="public-card-title">{selectedResult.competitionName}</strong>. Raw scores, grades and points are not shown on posters.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="public-section-title font-cinematic-editorial text-base sm:text-lg font-bold">Released poster templates</h2>
            <p className="public-muted mt-1 text-[11px]">Only templates publicly released from Media Studio appear here.</p>
          </div>
          <span className="public-muted text-[10px] sm:text-xs font-semibold">
            {loading ? 'Loading templates…' : `${templates.length} ${templates.length === 1 ? 'template' : 'templates'} available`}
          </span>
        </div>

        {loading ? (
          <div className="public-empty-state flex items-center justify-center gap-2 rounded-xl border py-14 text-xs">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading released poster templates…
          </div>
        ) : loadError ? (
          <div role="alert" className="public-alert rounded-xl border p-4 text-xs">{loadError}</div>
        ) : templates.length === 0 ? (
          <div className="public-empty-state rounded-xl border border-dashed px-6 py-12 text-center">
            <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#C58B00]" />
            <h3 className="public-card-title text-sm font-bold">No templates released yet</h3>
            <p className="public-muted mx-auto mt-2 max-w-md text-xs leading-relaxed">
              The festival team has not released a reusable poster template yet. Please check again after a template is released from Media Studio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {templates.map(template => (
              <article key={template.id} className="public-template-card flex min-w-0 flex-col overflow-hidden rounded-xl border p-3.5 sm:p-4 shadow-xs">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="public-card-title break-words text-[13px] font-bold">{template.name}</h3>
                    <p className="public-muted mt-1 text-[10px]">{template.config.aspectRatio} · {template.config.elements?.length ?? 0} design layers</p>
                  </div>
                  <span className="public-released-badge shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase">Released</span>
                </div>
                {selectedResult ? (
                  <ResultPosterPreview
                    result={selectedResult}
                    theme={theme}
                    config={template.config}
                    className="public-poster-preview w-full overflow-hidden rounded-xl border"
                  />
                ) : (
                  <div className="public-empty-state flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed p-5 text-center text-xs">
                    Publish a competition result to preview this template.
                  </div>
                )}
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="primary"
                    className="public-primary-button w-full"
                    disabled={!selectedResult || Boolean(downloadingId)}
                    isLoading={downloadingId === template.id}
                    leftIcon={<Download className="h-4 w-4" />}
                    onClick={() => void handleDownload(template)}
                  >
                    {downloadingId === template.id ? 'Preparing PNG…' : 'Download This Poster (PNG)'}
                  </Button>
                </div>
                {downloadedId === template.id && (
                  <p role="status" className="public-success-note mt-2 flex items-center justify-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Your poster download has started.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        {downloadError && <p role="alert" className="public-alert rounded-xl border p-3 text-xs">{downloadError}</p>}
      </div>
    </PublicLayout>
  );
}

export default function PublicPosterGalleryPage() {
  return <Suspense fallback={<div className="public-empty-state p-10 text-center text-xs">Loading poster gallery…</div>}><PublicPosterGalleryContent /></Suspense>;
}
