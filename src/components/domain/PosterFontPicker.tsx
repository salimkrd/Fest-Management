'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  POSTER_FONT_GROUPS,
  POSTER_FONT_OPTIONS,
  loadPosterFonts,
  posterFontCssFamily,
  type PosterFontOption,
} from '@/domain/posterFonts';

interface PosterFontPickerProps {
  value: string;
  onChange: (value: string) => void;
}

function optionValue(font: PosterFontOption): string {
  if (font.name.endsWith('(legacy)')) {
    if (font.name.startsWith('Sans-serif')) return 'sans';
    if (font.name.startsWith('Serif')) return 'serif';
    return 'mono';
  }
  return font.name;
}

/** Searchable, grouped typeface picker for every text layer in the Media Studio. */
export function PosterFontPicker({ value, onChange }: PosterFontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const selectedFont = useMemo(
    () => POSTER_FONT_OPTIONS.find(font => optionValue(font) === value),
    [value],
  );
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return POSTER_FONT_GROUPS.map(group => ({
      ...group,
      fonts: group.fonts.filter(font => !normalized ||
        font.name.toLowerCase().includes(normalized) ||
        group.category.toLowerCase().includes(normalized)),
    })).filter(group => group.fonts.length > 0);
  }, [query]);
  const flattened = useMemo(() => matches.flatMap(group => group.fonts), [matches]);

  useEffect(() => {
    if (['sans', 'serif', 'mono'].includes(value)) return;
    void loadPosterFonts([value]);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const choose = (font: PosterFontOption) => {
    const nextValue = optionValue(font);
    onChange(nextValue);
    if (!['sans', 'serif', 'mono'].includes(nextValue)) void loadPosterFonts([nextValue]);
    setOpen(false);
    setQuery('');
    setActive(0);
  };

  return <div ref={root} className="relative min-w-0" data-testid="poster-font-picker">
    <label id="poster-font-label" className="mb-1.5 block text-xs font-semibold text-slate-600">
      Font
    </label>
    <button type="button" aria-labelledby="poster-font-label" aria-haspopup="listbox"
      aria-expanded={open}
      className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
      onClick={() => { setOpen(old => !old); setQuery(''); setActive(0); }}>
      <span className="truncate" style={{ fontFamily: posterFontCssFamily(value) }}>
        {selectedFont?.name ?? (value === 'serif' ? 'Serif · Georgia' : value === 'mono' ? 'Monospace' : 'Sans-serif · Arial')}
      </span>
      <span aria-hidden="true" className="shrink-0 text-slate-400">⌄</span>
    </button>
    {open && <div className="absolute right-0 top-full z-[80] mt-1 w-full min-w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl sm:min-w-[250px]">
      <input ref={search} type="search" autoComplete="off" aria-label="Search poster fonts"
        role="combobox" aria-controls="poster-font-results" aria-expanded="true"
        aria-activedescendant={flattened[active] ? 'poster-font-option-' + optionValue(flattened[active]).replace(/[^a-zA-Z0-9_-]/g, '-') : undefined}
        placeholder="Search 100+ fonts..."
        className="mb-2 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={query}
        onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(index + 1, flattened.length - 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
          if (event.key === 'Enter' && flattened[active]) { event.preventDefault(); choose(flattened[active]); }
        }} />
      <div id="poster-font-results" role="listbox" aria-label="Poster fonts" className="max-h-72 overflow-y-auto overscroll-contain">
        {matches.length ? matches.map(group => <div key={group.category} className="pb-1.5">
          <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {group.category}
          </p>
          {group.fonts.map(font => {
            const fontValue = optionValue(font);
            const index = flattened.findIndex(item => optionValue(item) === fontValue);
            const selected = value === fontValue;
            return <button key={font.name} id={'poster-font-option-' + fontValue.replace(/[^a-zA-Z0-9_-]/g, '-')}
              type="button" role="option" aria-selected={selected}
              className={'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs ' +
                (active === index || selected ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50')}
              onMouseEnter={() => {
                setActive(index);
                if (!['sans', 'serif', 'mono'].includes(fontValue) && !font.name.endsWith('(legacy)')) {
                  void loadPosterFonts([fontValue]);
                }
              }}
              onClick={() => choose(font)}>
              <span className="truncate" style={{ fontFamily: font.family, fontSize: 14 }}>{font.name}</span>
              {selected && <span aria-hidden="true" className="shrink-0 font-bold text-blue-600">✓</span>}
            </button>;
          })}
        </div>) : <p className="p-3 text-xs text-slate-500">No matching fonts found.</p>}
      </div>
      <p className="px-2 pt-2 text-[9px] leading-relaxed text-slate-400">Fonts load on demand. Malayalam fonts are included for Malayalam text layers.</p>
    </div>}
  </div>;
}
