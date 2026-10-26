'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FESTIVAL_NAME_FONTS,
  festivalFontStylesheet,
  festivalNameFontFamily,
  DEFAULT_FESTIVAL_NAME_FONT
} from '@/domain/festivalFonts';

interface Props {
  value: string;
  onChange: (value: string) => void;
  previewName: string;
}

/** Searchable, keyboard-operable festival name font selector; it never changes body typography. */
export function FestivalFontPicker({ value, onChange, previewName }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () => FESTIVAL_NAME_FONTS.filter(font => font.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  useEffect(() => {
    if (!open) return;
    // Preview each typeface, loaded only when the menu opens.
    const href = festivalFontStylesheet(FESTIVAL_NAME_FONTS.map(font => font.name));
    if (href && !document.getElementById('festival-name-font-options')) {
      const link = document.createElement('link');
      link.id = 'festival-name-font-options';
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
    search.current?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const choose = (font: string) => {
    onChange(font);
    setOpen(false);
    setQuery('');
    setActive(0);
  };

  return <div ref={root} className="relative" data-testid="festival-font-picker">
    <label id="festival-font-label" className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1.5">
      Festival Name Font
    </label>
    <button type="button" aria-labelledby="festival-font-label" aria-haspopup="listbox"
      aria-expanded={open}
      className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 rounded-lg bg-white border border-[#E1E7EF] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={() => { setOpen(old => !old); setQuery(''); setActive(0); }}>
      <span style={{ fontFamily: festivalNameFontFamily(value) }} className="font-bold">{value || DEFAULT_FESTIVAL_NAME_FONT}</span>
      <span aria-hidden="true" className="text-[#526070]">⌄</span>
    </button>
    {open && <div className="absolute top-full mt-1 z-[60] w-full bg-white border border-[#E1E7EF] rounded-lg shadow-xl p-2">
      <input ref={search} type="search" autoComplete="off" aria-label="Search festival name fonts"
        role="combobox" aria-controls="festival-font-results" aria-expanded="true"
        aria-activedescendant={matches[active] ? 'font-option-' + FESTIVAL_NAME_FONTS.indexOf(matches[active]) : undefined}
        placeholder="Search fonts (e.g. Poppins, Anton)..."
        className="w-full border border-[#E1E7EF] rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={query} onChange={e => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
          if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active].name); }
        }} />
      <div id="festival-font-results" role="listbox" aria-label="Festival fonts" className="max-h-56 overflow-y-auto space-y-1">
        {matches.length ? matches.map((font, index) =>
          <button key={font.name} id={'font-option-' + FESTIVAL_NAME_FONTS.indexOf(font)}
            type="button" role="option" aria-selected={value === font.name}
            className={'w-full text-left px-3 py-2 rounded-md flex justify-between items-center gap-2 text-sm ' +
              (active === index || value === font.name ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50')}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(font.name)}>
            <span className="truncate" style={{ fontFamily: font.family, fontSize: 17 }}>{font.name}</span>
            {value === font.name && <span aria-hidden="true" className="text-blue-600">✓</span>}
          </button>
        ) : <p className="p-3 text-xs text-[#526070]">No matching fonts.</p>}
      </div>
    </div>}
    <div className="rounded-lg bg-[#F8FAFC] border border-[#E1E7EF] px-4 py-3 mt-2">
      <p className="text-[10px] uppercase font-semibold text-[#526070] mb-1">Festival Name Preview</p>
      <p className="text-xl font-bold break-words" style={{ fontFamily: festivalNameFontFamily(value) }}>
        {previewName || 'Festival Name'}
      </p>
    </div>
  </div>;
}
