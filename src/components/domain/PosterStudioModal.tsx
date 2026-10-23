'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Globe } from 'lucide-react';
import type { CompetitionResult } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ResultPosterPreview } from '@/components/domain/ResultPosterPreview';
import { useFest } from '@/context/FestContext';
import { exportPosterAsPng } from '@/utils/canvasExport';

interface PosterStudioModalProps {
  result: CompetitionResult | null;
  isOpen: boolean;
  onClose: () => void;
}

function PosterPreviewContent({ result, onClose }: {
  result: CompetitionResult;
  onClose: () => void;
}) {
  const { theme } = useFest();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const config = result.posterDraftConfig ?? result.posterConfig ?? result.posterPublishedConfig;
  const isPublic = result.resultStatus === 'PUBLISHED' && result.posterReleased;

  async function handleDownload() {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadComplete(false);
    try {
      await exportPosterAsPng(result, theme, config);
      setDownloadComplete(true);
    } catch {
      setDownloadError('The poster could not be downloaded. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Result Poster Preview"
      description={`${result.competitionName} · ${result.categoryName}`}
      maxWidth="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isDownloading}
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleDownload}
          >
            {isDownloading ? 'Preparing poster…' : 'Download PNG'}
          </Button>
          <Link
            href="/admin/media"
            onClick={onClose}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-medium text-white hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Open Poster Studio <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#E1E7EF] bg-[#F8FAFC] p-4">
          <p className="text-xs font-bold text-[#111111]">Saved design preview</p>
          <p className="mt-1 text-xs leading-relaxed text-[#526070]">
            Open Poster Studio to edit the template, position text and photos, or release the finished poster to the public site.
          </p>
          <p className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${isPublic ? 'text-emerald-700' : 'text-[#526070]'}`}>
            <Globe className="h-3.5 w-3.5" />
            {isPublic ? 'A released version is available on the public site.' : 'This poster is not released to the public site.'}
          </p>
          {isPublic && (
            <Link href={`/public/competition/${result.competitionId}#poster`} onClick={onClose} className="mt-2 inline-block text-xs font-semibold text-[#2563EB] hover:underline">
              View public poster
            </Link>
          )}
        </div>
        <ResultPosterPreview result={result} theme={theme} config={config} className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl shadow-sm" />
        {downloadError && <p role="alert" className="text-sm text-red-700">{downloadError}</p>}
        {downloadComplete && <p role="status" className="text-center text-xs text-emerald-700">Your poster download has started.</p>}
      </div>
    </Modal>
  );
}

export function PosterStudioModal({ result, isOpen, onClose }: PosterStudioModalProps) {
  return result && isOpen ? <PosterPreviewContent key={result.id} result={result} onClose={onClose} /> : null;
}
