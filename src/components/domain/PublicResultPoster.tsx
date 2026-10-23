'use client';

import { useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { ResultPosterPreview } from '@/components/domain/ResultPosterPreview';
import { Button } from '@/components/ui/Button';
import type { CompetitionResult, PublicThemeSettings } from '@/types/fest';
import { exportPosterAsPng } from '@/utils/canvasExport';

interface PublicResultPosterProps {
  result: CompetitionResult;
  theme: PublicThemeSettings;
}

export function PublicResultPoster({ result, theme }: PublicResultPosterProps) {
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'complete'>('idle');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const releasedConfig = result.posterPublishedConfig ?? result.posterConfig;

  if (result.resultStatus !== 'PUBLISHED' || !result.posterReleased) return null;

  async function handleDownload() {
    setDownloadError(null);
    setDownloadState('downloading');

    try {
      await exportPosterAsPng(result, theme, releasedConfig);
      setDownloadState('complete');
    } catch {
      setDownloadState('idle');
      setDownloadError('The poster could not be downloaded. Please try again.');
    }
  }

  return (
    <div className="space-y-4">
      <ResultPosterPreview
        result={result}
        theme={theme}
        config={releasedConfig}
        className="w-full overflow-hidden rounded-2xl shadow-sm"
      />
      <Button
        type="button"
        variant="primary"
        className="w-full"
        isLoading={downloadState === 'downloading'}
        leftIcon={<Download className="h-4 w-4" />}
        onClick={handleDownload}
        aria-label={`Download official result poster for ${result.competitionName} as PNG`}
      >
        {downloadState === 'downloading' ? 'Preparing poster…' : 'Download Poster (PNG)'}
      </Button>
      {downloadError ? (
        <p role="alert" className="text-sm text-red-700">{downloadError}</p>
      ) : downloadState === 'complete' ? (
        <p role="status" className="flex items-center justify-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Your poster download has started.
        </p>
      ) : null}
    </div>
  );
}
