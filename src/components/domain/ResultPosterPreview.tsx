'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompetitionResult, PosterConfig, PosterElement, PublicThemeSettings } from '@/types/fest';
import { normalizePosterConfig, posterSvgDataUrl, posterDimensions, orderedPosterWinners } from '@/domain/poster';
import { loadPosterFonts } from '@/domain/posterFonts';

interface ResultPosterPreviewProps {
  result: CompetitionResult;
  theme: PublicThemeSettings;
  config?: PosterConfig;
  className?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, position: { x: number; y: number }) => void;
  showGrid?: boolean;
}

export function ResultPosterPreview({ result, theme, config, className = '', selectedId, onSelect, onMove, showGrid }: ResultPosterPreviewProps) {
  const normalized = useMemo(() => normalizePosterConfig(config), [config]);
  const [fontVersion, setFontVersion] = useState(0);
  const usedFontNames = useMemo(
    () => [...new Set((normalized.elements ?? [])
      .filter(element => element.type === 'text' && element.field !== 'festivalName')
      .map(element => element.fontFamily)
      .concat((normalized.winnerContainer?.layers ?? []).filter(layer => layer.type === 'text').map(layer => layer.fontFamily))
      .filter(name => !['sans', 'serif', 'mono'].includes(name)))].sort().join('|'),
    [normalized],
  );

  useEffect(() => {
    if (!usedFontNames) return;
    let active = true;
    void loadPosterFonts(usedFontNames.split('|')).finally(() => {
      if (active) setFontVersion(version => version + 1);
    });
    return () => { active = false; };
  }, [usedFontNames]);

  // A fragment change makes the SVG image re-render after web fonts finish loading.
  const source = useMemo(
    () => posterSvgDataUrl(result, theme, normalized) + '#font-version-' + fontVersion,
    [result, theme, normalized, fontVersion],
  );
  const dimensions = posterDimensions(normalized.aspectRatio);
  const drag = useRef<{ id: string; startX: number; startY: number; x: number; y: number; width: number; height: number; canvasWidth: number; canvasHeight: number } | null>(null);
  const move = (id: string, layer: { width: number; height: number }, x: number, y: number) => onMove?.(id, {
    x: Math.max(0, Math.min(100 - layer.width, x)), y: Math.max(0, Math.min(100 - layer.height, y)),
  });
  const winnerContainer = normalized.winnerContainer;
  const winnerRows = orderedPosterWinners(result);
  const winnerRowCapacity = Math.max(3, winnerRows.length);
  const winnerRowHeight = winnerContainer && winnerRows.length
    ? Math.max(0, (winnerContainer.height - winnerContainer.rowGap * (winnerRowCapacity - 1)) / winnerRowCapacity)
    : 0;

  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
      {/* An embedded SVG keeps every viewer and exported PNG on the same artwork. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt={`Official result poster: ${result.competitionName}, ${result.categoryName}. ${result.ranks.filter(rank => rank.rank).map(rank => `Rank ${rank.rank}: ${rank.candidateName}`).join('. ')}`} className="block h-full w-full select-none" draggable={false} />
      {showGrid && <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '5% 5%' }} />}
      {onSelect && normalized.elements?.map(element => (
        <button key={element.id} type="button" aria-label={`Edit ${element.label}`} aria-pressed={selectedId === element.id}
          className={`absolute touch-none cursor-move rounded-sm border-2 outline-none transition-colors focus-visible:border-blue-400 ${selectedId === element.id ? 'border-blue-400 bg-blue-400/10' : 'border-transparent hover:border-blue-300/70'}`}
          style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%` }}
          onClick={() => onSelect(element.id)}
          onPointerDown={event => {
            if (event.button !== 0) return;
            onSelect(element.id);
            const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
            drag.current = { id: element.id, startX: event.clientX, startY: event.clientY, x: element.x, y: element.y, width: element.width, height: element.height, canvasWidth: bounds.width, canvasHeight: bounds.height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const state = drag.current;
            if (!state || state.id !== element.id) return;
            move(element.id, element, state.x + (event.clientX - state.startX) / state.canvasWidth * 100, state.y + (event.clientY - state.startY) / state.canvasHeight * 100);
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={event => {
            const amount = event.shiftKey ? 2 : .5;
            const directions: Record<string, [number, number]> = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] };
            if (directions[event.key]) { event.preventDefault(); const [x, y] = directions[event.key]; move(element.id, element, element.x + x, element.y + y); }
          }}>
          {selectedId === element.id && <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded-sm bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">{element.label}</span>}
        </button>
      ))}
      {onSelect && winnerContainer && (
        <button
          type="button"
          aria-label="Select or move Winner Container"
          aria-pressed={selectedId === '__winner-container__'}
          className={`absolute touch-none rounded-sm border-2 outline-none ${selectedId === '__winner-container__' ? 'border-teal-500 bg-teal-400/10 cursor-move' : 'border-transparent hover:border-teal-400/70 cursor-move'}`}
          style={{ left: `${winnerContainer.x}%`, top: `${winnerContainer.y}%`, width: `${winnerContainer.width}%`, height: `${winnerContainer.height}%` }}
          onClick={() => onSelect('__winner-container__')}
          onPointerDown={event => {
            if (event.button !== 0) return;
            onSelect('__winner-container__');
            const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
            drag.current = { id: '__winner-container__', startX: event.clientX, startY: event.clientY, x: winnerContainer.x, y: winnerContainer.y, width: winnerContainer.width, height: winnerContainer.height, canvasWidth: bounds.width, canvasHeight: bounds.height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const state = drag.current;
            if (!state || state.id !== '__winner-container__') return;
            move('__winner-container__', winnerContainer, state.x + (event.clientX - state.startX) / state.canvasWidth * 100, state.y + (event.clientY - state.startY) / state.canvasHeight * 100);
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={event => {
            const amount = event.shiftKey ? 2 : .5;
            const directions: Record<string, [number, number]> = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] };
            if (directions[event.key]) { event.preventDefault(); const [x, y] = directions[event.key]; move('__winner-container__', winnerContainer, winnerContainer.x + x, winnerContainer.y + y); }
          }}
        >
          {selectedId === '__winner-container__' && <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded-sm bg-teal-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Winner Container</span>}
        </button>
      )}
      {onSelect && winnerContainer && winnerRowHeight > 0 && winnerRows.map((winner, rowIndex) =>
        winnerContainer.layers.map(layer => {
          const id = `__winner-item:${layer.field}__`;
          const rowTop = winnerContainer.y + rowIndex * (winnerRowHeight + winnerContainer.rowGap);
          const left = winnerContainer.x + winnerContainer.width * layer.x / 100;
          const top = rowTop + winnerRowHeight * layer.y / 100;
          const width = winnerContainer.width * layer.width / 100;
          const height = winnerRowHeight * layer.height / 100;
          const selected = selectedId === id;
          return <button key={`${winner.registrationId}-${layer.field}`} type="button"
            aria-label={`Select ${layer.label} for winner ${rowIndex + 1}`} aria-pressed={selected}
            className={`absolute rounded-sm border-2 outline-none transition-colors ${selected ? 'border-blue-500 bg-blue-400/10' : 'border-transparent hover:border-blue-300/70'}`}
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, cursor: 'pointer' }}
            onClick={() => onSelect(id)}
          >
            {selected && rowIndex === 0 && <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded-sm bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">{layer.label} · All Winners</span>}
          </button>;
        })
      )}
    </div>
  );
}
