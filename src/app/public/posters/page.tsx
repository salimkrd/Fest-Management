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
      <div className="mx-auto max-w-6xl space-y-7">
        <div>
          <Link href="/public" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#2563EB] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to published results
          </Link>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#2563EB]">Official Media Studio</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#111111] sm:text-3xl">Choose a Result Poster</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#526070]">
                Select a published competition, preview the templates released by the festival, and download your favourite design. Every released template works with every published result.
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-[#E1E7EF] bg-white p-4 sm:p-5">
          <label htmlFor="poster-result-select" className="mb-2 block text-xs font-bold text-[#111111]">Competition result</label>
          <select
            id="poster-result-select"
            value={selectedResult?.id || ''}
            onChange={event => {
              setSelectedResultId(event.target.value);
              setDownloadedId(null);
              setDownloadError('');
            }}
            disabled={publishedResults.length === 0}
            className="w-full max-w-2xl rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-sm text-[#111111] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
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
            <p className="mt-2 text-xs text-[#526070]">
              Posters will use the published winners for <strong className="text-[#111111]">{selectedResult.competitionName}</strong>. Raw scores, grades and points are not shown on posters.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111111]">Released poster templates</h2>
            <p className="mt-1 text-xs text-[#526070]">Only templates publicly released from Media Studio appear here.</p>
          </div>
          <span className="text-xs font-semibold text-[#526070]">
            {loading ? 'Loading templates…' : `${templates.length} ${templates.length === 1 ? 'template' : 'templates'} available`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E1E7EF] bg-white py-16 text-sm text-[#526070]">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading released poster templates…
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{loadError}</div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center">
            <ImageIcon className="mx-auto mb-3 h-9 w-9 text-[#94A3B8]" />
            <h3 className="text-sm font-bold text-[#111111]">No templates released yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#526070]">
              The festival team has not released a reusable poster template yet. Please check again after a template is released from Media Studio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {templates.map(template => (
              <article key={template.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E1E7EF] bg-white p-4 shadow-xs">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-bold text-[#111111]">{template.name}</h3>
                    <p className="mt-1 text-[11px] text-[#64748B]">{template.config.aspectRatio} · {template.config.elements?.length ?? 0} design layers</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">Released</span>
                </div>
                {selectedResult ? (
                  <ResultPosterPreview
                    result={selectedResult}
                    theme={theme}
                    config={template.config}
                    className="w-full overflow-hidden rounded-xl border border-[#E1E7EF] bg-slate-50"
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-slate-50 p-5 text-center text-xs text-[#64748B]">
                    Publish a competition result to preview this template.
                  </div>
                )}
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    disabled={!selectedResult || Boolean(downloadingId)}
                    isLoading={downloadingId === template.id}
                    leftIcon={<Download className="h-4 w-4" />}
                    onClick={() => void handleDownload(template)}
                  >
                    {downloadingId === template.id ? 'Preparing PNG…' : 'Download This Poster (PNG)'}
                  </Button>
                </div>
                {downloadedId === template.id && (
                  <p role="status" className="mt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Your poster download has started.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        {downloadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{downloadError}</p>}
      </div>
    </PublicLayout>
  );
}

export default function PublicPosterGalleryPage() {
  return <Suspense fallback={<div className="p-12 text-center text-sm text-[#526070]">Loading poster gallery…</div>}><PublicPosterGalleryContent /></Suspense>;
}
