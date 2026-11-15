import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('INSPIRAATH 2026 Stitch Approved Homepage Implementation', () => {
  const pageSrc = readProjectFile('src/app/public/page.tsx');
  const cssSrc = readProjectFile('src/app/globals.css');
  const layoutSrc = readProjectFile('src/app/layout.tsx');

  describe('1. Approved Visual Reference & Styles', () => {
    it('declares the approved font families in globals.css', () => {
      expect(cssSrc).toContain('.font-brand');
      expect(cssSrc).toContain('Bruno Ace');
      expect(cssSrc).toContain('.font-cinematic-editorial');
      expect(cssSrc).toContain('Cinzel');
      expect(cssSrc).toContain('.font-editorial');
      expect(cssSrc).toContain('Playfair Display');
      expect(cssSrc).toContain('.font-body');
      expect(cssSrc).toContain('Sora');
    });

    it('contains the approved ruby and espresso background gradients', () => {
      expect(cssSrc).toContain('.hero-ruby-bg');
      expect(cssSrc).toContain('#4A0A1C');
      expect(cssSrc).toContain('#86152C');
      expect(cssSrc).toContain('#A91D3A');
      expect(cssSrc).toContain('.banner-ruby-bg');
      expect(cssSrc).toContain('.console-dark-bg');
    });

    it('defines the keyframe animations for the scholar lamp and glow micro-interactions', () => {
      expect(cssSrc).toContain('@keyframes lampSwing');
      expect(cssSrc).toContain('@keyframes lampFlameGlow');
      expect(cssSrc).toContain('@keyframes lampFlicker');
      expect(cssSrc).toContain('@keyframes ambientGlowPulse');
      expect(cssSrc).toContain('.btn-hero-primary');
      expect(cssSrc).toContain('.btn-hero-secondary');
      expect(cssSrc).toContain('.btn-lookup');
      expect(cssSrc).toContain('.btn-verify');
      expect(cssSrc).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('loads the required Google Fonts in layout.tsx', () => {
      expect(layoutSrc).toContain('family=Bruno+Ace');
      expect(layoutSrc).toContain('family=Cinzel');
      expect(layoutSrc).toContain('family=Playfair+Display');
      expect(layoutSrc).toContain('family=Sora');
      expect(layoutSrc).toContain('family=Material+Symbols+Outlined');
    });
  });

  describe('2. Asset Verification and Integration', () => {
    it('verifies local theme and lamp PNG files exist in public/images', () => {
      expect(existsSync(resolve(process.cwd(), 'public/images/theme.png'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public/images/lamp.png'))).toBe(true);
    });

    it('uses next/image for theme and lamp assets and does not use remote AIDA URLs or main_posterxas.png', () => {
      expect(pageSrc).toContain("src=\"/images/theme.png\"");
      expect(pageSrc).toContain("src=\"/images/lamp.png\"");
      expect(pageSrc).not.toContain('aida-public');
      expect(pageSrc).not.toContain('main_posterxas.png');
    });
  });

  describe('3. Dynamic Firebase Data & House Championship Standings', () => {
    it('consumes useFest hook without static hardcoded house arrays', () => {
      expect(pageSrc).toContain('useFest()');
      expect(pageSrc).toContain('teams');
      expect(pageSrc).toContain('results');
      expect(pageSrc).toContain('categories');
      expect(pageSrc).toContain('competitions');
      expect(pageSrc).not.toContain('const HOUSES = [');
      expect(pageSrc).not.toContain('SAMPLE_PENDING_RESULTS');
    });

    it('dynamically computes leader rank, margin, and handles empty teams', () => {
      expect(pageSrc).toContain('sortedTeams');
      expect(pageSrc).toContain('leaderMargin');
      expect(pageSrc).toContain('Championship Standings Awaiting Tabulation');
    });
  });

  describe('4. Quick Competition Result Finder & Latest Results Filters', () => {
    it('dynamically renders categories and competitions into finder dropdowns', () => {
      expect(pageSrc).toContain('availableFinderEvents');
      expect(pageSrc).toContain('finderCategory');
      expect(pageSrc).toContain('finderEvent');
      expect(pageSrc).toContain('finderInput');
    });

    it('enforces grade-only display and does not expose raw points/scores in individual results', () => {
      expect(pageSrc).toContain('Grade {matchedRecord.rank.grade');
      expect(pageSrc).not.toMatch(/Score:\s*\{matchedRecord/);
      expect(pageSrc).not.toMatch(/pts\s*\|\s*points/i);
    });

    it('filters latest results by activeDivisionTab and displays empty state when none match', () => {
      expect(pageSrc).toContain('activeDivisionTab');
      expect(pageSrc).toContain('filteredLatestResults');
      expect(pageSrc).toContain('No Ratified Results Published Yet');
      expect(pageSrc).toContain('PosterDownloadDialog');
    });
  });

  describe('5. App Router Compatibility, Navigation, & Festival Settings', () => {
    it('includes use client and does not use next/head', () => {
      expect(pageSrc.trim().startsWith("'use client'")).toBe(true);
      expect(pageSrc).not.toContain("from 'next/head'");
    });

    it('wires valid internal application routes', () => {
      expect(pageSrc).toContain('href="/public/directory"');
      expect(pageSrc).toContain('href="/public/championship"');
      expect(pageSrc).toContain('/public/competition/');
    });

    it('retrieves festival title, venue, and dates from Festival Settings', () => {
      expect(pageSrc).toContain('theme.festivalStartDate');
      expect(pageSrc).toContain('theme.festivalEndDate');
      expect(pageSrc).toContain('theme.institutionName');
    });

    it('implements responsive mobile navigation drawer with accessible attributes', () => {
      expect(pageSrc).toContain('mobileMenuOpen');
      expect(pageSrc).toContain('aria-label="Toggle navigation menu"');
      expect(pageSrc).toContain('aria-expanded={mobileMenuOpen}');
    });
  });

  describe('6. Final regression corrections', () => {
    it('keeps the transparent Header inside the Hero section', () => {
      expect(pageSrc.indexOf('id="home"')).toBeLessThan(pageSrc.indexOf('HEADER: Deep Ruby-Espresso'));
      expect(pageSrc.indexOf('HEADER: Deep Ruby-Espresso')).toBeLessThan(pageSrc.indexOf('Ambient Glows'));
    });

    it('does not hardcode a fallback festival date or weekday', () => {
      expect(pageSrc).toContain("'Dates to be announced'");
      expect(pageSrc).not.toContain('Nov 24 & 25');
      expect(pageSrc).not.toContain('Tuesday & Wednesday');
    });

    it('does not claim a fabricated 100 percent verification result', () => {
      expect(pageSrc).not.toContain('Verified 100%');
      expect(pageSrc).toContain('Official Published Results');
      expect(pageSrc).not.toContain('authenticated judge ratings');
    });

    it('does not return an arbitrary first record for an empty finder submission', () => {
      expect(pageSrc).toContain("if (!query && finderCategory === 'all' && finderEvent === 'all')");
      expect(pageSrc).toContain('finderHasSearched && (finderInput.trim() || finderCategory !==');
    });

    it('distinguishes Firestore loading and error states from true empty states', () => {
      expect(pageSrc).toContain("teamsSyncState === 'loading'");
      expect(pageSrc).toContain("teamsSyncState === 'error'");
      expect(pageSrc).toContain("resultsSyncState === 'loading'");
      expect(pageSrc).toContain("resultsSyncState === 'error'");
    });
  });
});
