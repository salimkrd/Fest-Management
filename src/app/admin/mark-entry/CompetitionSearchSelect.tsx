'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Competition } from '@/types/fest';

type SearchableCompetition = Pick<Competition, 'id' | 'name' | 'code' | 'categoryName'>;

interface CompetitionSearchSelectProps {
  competitions: SearchableCompetition[];
  value: string;
  onChange: (competitionId: string) => void;
}

export function filterCompetitions(
  competitions: SearchableCompetition[],
  query: string
): SearchableCompetition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return competitions;

  return competitions.filter((competition) =>
    [competition.name, competition.code, competition.categoryName]
      .some((field) => field.toLocaleLowerCase().includes(normalizedQuery))
  );
}

export function CompetitionSearchSelect({
  competitions,
  value,
  onChange
}: CompetitionSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selectedCompetition = competitions.find((competition) => competition.id === value);
  const filteredCompetitions = useMemo(
    () => filterCompetitions(competitions, query),
    [competitions, query]
  );
  const activeOptionId = filteredCompetitions[activeIndex]
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
        setActiveIndex(0);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const closeDropdown = () => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  const chooseCompetition = (competition: SearchableCompetition) => {
    onChange(competition.id);
    closeDropdown();
    triggerRef.current?.focus();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredCompetitions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const activeCompetition = filteredCompetitions[activeIndex];
      if (activeCompetition) chooseCompetition(activeCompetition);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <label id={`${listboxId}-label`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#111111]">
        Select Competition
      </label>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-labelledby={`${listboxId}-label ${listboxId}-value`}
        onClick={() => {
          if (isOpen) {
            closeDropdown();
          } else {
            setQuery('');
            setActiveIndex(0);
            setIsOpen(true);
          }
        }}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-[#E1E7EF] bg-white px-3.5 py-2.5 text-left text-sm text-[#111111] transition-colors hover:border-slate-300 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
      >
        <span id={`${listboxId}-value`} className="min-w-0 flex-1 truncate">
          {selectedCompetition
            ? `${selectedCompetition.name} (${selectedCompetition.code} - ${selectedCompetition.categoryName})`
            : 'Choose a competition'}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#526070] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[70] mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="search"
                role="combobox"
                aria-label="Search competitions"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by competition, code or category..."
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear competition search"
                  onClick={() => {
                    setQuery('');
                    setActiveIndex(0);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-slate-500">
              {filteredCompetitions.length} of {competitions.length} competitions
            </p>
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label="Available competitions"
            className="max-h-60 overflow-y-auto overscroll-contain p-1.5"
          >
            {filteredCompetitions.length === 0 ? (
              <p className="px-3 py-7 text-center text-sm text-slate-500">
                {competitions.length === 0
                  ? 'No competitions are available.'
                  : 'No matching competitions. Try another search.'}
              </p>
            ) : (
              filteredCompetitions.map((competition, index) => {
                const isSelected = competition.id === value;
                const isActive = index === activeIndex;

                return (
                  <div
                    key={competition.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseCompetition(competition)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'} ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{competition.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {competition.code} <span aria-hidden="true">·</span> {competition.categoryName}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
