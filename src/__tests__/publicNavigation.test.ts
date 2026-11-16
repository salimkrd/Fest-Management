import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Public navigation and retired media gallery', () => {
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');
  const posterRoute = readProjectFile('src/app/public/posters/page.tsx');
  const competitionPage = readProjectFile('src/app/public/competition/[id]/page.tsx');
  const posterDialog = readProjectFile('src/components/domain/PosterDownloadDialog.tsx');

  it('removes the Media Studio destination from desktop, mobile, and footer navigation', () => {
    expect(publicLayout).not.toContain('/public/posters');
    expect(publicLayout).not.toContain('Media Studio');
    expect(publicLayout).not.toContain('Media Studio Posters');
    expect(publicLayout).not.toContain('Gazette &amp; Visual Studio');
  });

  it('removes the round festival logo image from the shared public header', () => {
    expect(publicLayout).not.toContain('FestivalLogo');
    expect(publicLayout).toContain('theme.festivalName');
    expect(publicLayout).not.toContain('theme.institutionName');
    expect(publicLayout).toContain('sticky top-0 z-40');
  });

  it('redirects legacy public poster gallery links to the Results Directory', () => {
    expect(posterRoute).toContain("import { redirect } from 'next/navigation'");
    expect(posterRoute).toContain("redirect('/public/directory')");
  });

  it('keeps result-specific poster downloads on competition detail pages', () => {
    expect(competitionPage).toContain('<PosterDownloadDialog result={result} theme={theme} />');
    expect(competitionPage).not.toContain('/public/posters');
    expect(competitionPage).not.toContain('View All Templates');
  });

  it('shares the relevant competition result rather than the retired gallery URL', () => {
    expect(posterDialog).toContain('/public/competition/${encodeURIComponent(result.competitionId)}');
    expect(posterDialog).not.toContain('/public/posters');
  });
});


describe('Public championship page simplification', () => {
  const championshipPage = readProjectFile('src/app/public/championship/page.tsx');

  it('removes the guild dossier, division cards, and victor laureates block', () => {
    expect(championshipPage).not.toContain('GUILD DOSSIER BREAKDOWN');
    expect(championshipPage).not.toContain('Senior Division');
    expect(championshipPage).not.toContain('General Division');
    expect(championshipPage).not.toContain('Sub-Junior Division');
    expect(championshipPage).not.toContain('Key Victor Laureates');
    expect(championshipPage).not.toContain('teamLaureates');
  });

  it('removes the point allocation rubric and authentication seal panels', () => {
    expect(championshipPage).not.toContain('Championship Point Allocation Framework');
    expect(championshipPage).not.toContain('Authentication Seal');
    expect(championshipPage).not.toContain('Central Tabulation Directorate');
    expect(championshipPage).not.toContain('Download Certified Ledger (PDF)');
    expect(championshipPage).not.toContain('handlePrintLedger');
  });

  it('removes dossier inspection actions but preserves the podium and main team ledger', () => {
    expect(championshipPage).not.toContain('Inspect Guild Dossier');
    expect(championshipPage).not.toContain('Audit Dossier');
    expect(championshipPage).toContain('<ChampionshipPodium teams={teams} />');
    expect(championshipPage).toContain('OFFICIAL GUILD RATIFICATION TABLE');
    expect(championshipPage).toContain('Cumulative Aggregate');
  });
});


describe('Public Results Directory bottom action strip removal', () => {
  const directoryPage = readProjectFile('src/app/public/directory/page.tsx');

  it('removes the full-session gazette export and print controls', () => {
    expect(directoryPage).not.toContain('PAGINATION & EXPORT FOLIO BAR');
    expect(directoryPage).not.toContain('Export Full Session Gazette (PDF)');
    expect(directoryPage).not.toContain('Print official merit summary');
    expect(directoryPage).not.toContain('handleExportGazette');
    expect(directoryPage).not.toContain('exportingGazette');
  });

  it('removes the redundant Showing Records count in the bottom strip', () => {
    expect(directoryPage).not.toContain('Showing Records 01 -');
  });

  it('preserves the search filters, published result cards, and result navigation', () => {
    expect(directoryPage).toContain('SEARCH, DIVISION TABS & ADVANCED FILTER SUITE');
    expect(directoryPage).toContain('OFFICIAL COMPETITION RESULTS GRID');
    expect(directoryPage).toContain('<PosterDownloadDialog result={res} theme={theme} />');
    expect(directoryPage).toContain('/public/competition/');
  });
});


describe('Shared compact footer across primary public pages', () => {
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');
  const publicHome = readProjectFile('src/app/public/page.tsx');
  const sharedFooter = readProjectFile('src/components/layout/PublicFooter.tsx');

  it('uses one shared footer on Home, Results Directory, and Team Championship layouts', () => {
    expect(publicHome).toContain('<PublicFooter />');
    expect(publicLayout).toContain('<PublicFooter />');
    expect(publicHome).toContain("import { PublicFooter } from '@/components/layout/PublicFooter'");
    expect(publicLayout).toContain("import { PublicFooter } from '@/components/layout/PublicFooter'");
  });

  it('keeps only the festival identity, institution, and the three primary public links', () => {
    expect(sharedFooter).toContain('theme.festivalName');
    expect(sharedFooter).toContain('theme.institutionName');
    expect(sharedFooter).toContain('Results Directory');
    expect(sharedFooter).toContain('Team Championship');
    expect(sharedFooter).toContain('Public footer navigation');
  });

  it('removes the old verbose and duplicated footer descriptions', () => {
    expect(publicHome).not.toContain('OFFICIAL SECRETARIAT FOOTER');
    expect(publicHome).not.toContain('Campus Contact Details');
    expect(publicLayout).not.toContain('Biennial Academic &amp; Cultural Convocation');
    expect(publicLayout).not.toContain('Central Directorate of Examination');
    expect(publicLayout).not.toContain('SANCTIFIED UNDER CENTRAL DIRECTIVE');
  });
});


describe('Public championship division and official points integrity', () => {
  const championshipPage = readProjectFile('src/app/public/championship/page.tsx');
  const competitionDetail = readProjectFile('src/app/public/competition/[id]/page.tsx');
  const directoryPage = readProjectFile('src/app/public/directory/page.tsx');

  it('builds division-filtered standings from published results rather than only changing the selected tab', () => {
    expect(championshipPage).toContain('buildDivisionTeamStandings(teams, results, selectedDivision)');
    expect(championshipPage).toContain('{displayedTeams.map((team, idx) => {');
    expect(championshipPage).toContain('resultsSyncState');
    expect(championshipPage).toContain('No Published Results for This Division');
  });

  it('does not show a podium or share percentages when division point data is incomplete', () => {
    expect(championshipPage).toContain('divisionPointsIncomplete');
    expect(championshipPage).toContain('No points are estimated from rank');
    expect(championshipPage).toContain('sharePercent === null');
  });

  it('never manufactures 10, 5, or 3 points for a public result from its place number', () => {
    expect(competitionDetail).not.toContain('?? 10');
    expect(competitionDetail).not.toContain('?? 5');
    expect(competitionDetail).not.toContain('?? 3');
    expect(competitionDetail).not.toContain('?? 0} pts');
    expect(competitionDetail).toContain('getPublishedOfficialPoints');
    expect(competitionDetail).toContain('Unavailable');
  });

  it('shows the real competition total only after the competition subscription is ready', () => {
    expect(directoryPage).not.toContain('competitions.length || 54');
    expect(directoryPage).toContain('competitionsSyncState');
    expect(directoryPage).toContain('Loading event total');
    expect(directoryPage).toContain('${publishedResults.length} / ${competitions.length} Events Ratified');
  });
});


describe('Public-only stylesheet isolation', () => {
  const globalCss = readProjectFile('src/app/globals.css');
  const publicCss = readProjectFile('src/app/public/public.css');
  const rootLayout = readProjectFile('src/app/layout.tsx');
  const rootPage = readProjectFile('src/app/page.tsx');
  const homePage = readProjectFile('src/app/public/page.tsx');
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');
  const publicRouteLayout = readProjectFile('src/app/public/layout.tsx');

  it('keeps public theme CSS out of the shared global stylesheet while retaining judge print styles', () => {
    expect(globalCss).not.toContain('.public-experience');
    expect(globalCss).not.toContain('.font-brand');
    expect(globalCss).not.toContain('.material-symbols-outlined');
    expect(globalCss).toContain('.judge-receipt-print');
  });

  it('loads public CSS from the public home and public route layout only', () => {
    expect(rootPage).toContain("import './public/public.css'");
    expect(publicRouteLayout).toContain("import './public.css'");
    expect(publicCss).toContain('.public-experience .font-brand');
    expect(publicCss).not.toContain('material-symbols-outlined');
    expect(publicCss).toContain('var(--festival-name-font');
  });

  it('scopes the public theme inside public wrappers and keeps root portal typography unchanged', () => {
    expect(homePage).toContain('className="public-experience bg-[#FDBF0F]');
    expect(publicLayout).toContain('className="public-experience min-h-screen');
    expect(rootLayout).toContain('bg-white text-[#111111]');
    expect(rootLayout).not.toContain('family=Bruno+Ace');
    expect(publicCss).toContain('.public-experience .public-main');
  });
});


describe('Participant portal access in the public header', () => {
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');

  it('shows an accessible Participant Login icon link in the top-right header', () => {
    expect(publicLayout).toContain('href="/participant/login"');
    expect(publicLayout).toContain('aria-label="Participant Login"');
    expect(publicLayout).toContain('<UserRound');
  });

  it('removes the header search field and mobile header navigation drawer', () => {
    expect(publicLayout).not.toContain('Search Bib, Candidate, Event');
    expect(publicLayout).not.toContain('PublicSearchBar');
    expect(publicLayout).not.toContain('public-mobile-navigation');
    expect(publicLayout).not.toContain('Toggle navigation');
    expect(publicLayout).not.toContain('useRouter');
  });

  it('retains desktop public navigation and the mobile bottom navigation', () => {
    expect(publicLayout).toContain('<PublicNavLinks />');
    expect(publicLayout).toContain('<MobileBottomNav />');
    expect(publicLayout).toContain('aria-label="Mobile Navigation"');
  });
});


describe('Public homepage uses the same shared navigation as all public pages', () => {
  const homePage = readProjectFile('src/app/public/page.tsx');
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');

  it('wraps the homepage in the shared PublicLayout instead of rendering a separate header', () => {
    expect(homePage).toContain('<PublicLayout>');
    expect(homePage).toContain('</PublicLayout>');
    expect(homePage).not.toContain('Toggle navigation menu');
    expect(homePage).not.toContain('mobile-navigation');
    expect(homePage).not.toContain('Desktop Navigation');
  });

  it('does not duplicate the footer or mobile bottom navigation on the homepage', () => {
    expect(homePage).not.toContain('<PublicFooter');
    expect(homePage).not.toContain('Mobile Fixed Bottom Navigation Bar');
    expect(publicLayout).toContain('<MobileBottomNav />');
    expect(publicLayout).toContain('<PublicFooter />');
  });

  it('uses the same participant login header action and shared desktop/mobile navigation', () => {
    expect(publicLayout).toContain('href="/participant/login"');
    expect(publicLayout).toContain('<PublicNavLinks />');
    expect(publicLayout).toContain('<MobileBottomNav />');
  });
});


describe('Public homepage shared shell build regression', () => {
  const homePage = readProjectFile('src/app/public/page.tsx');
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');

  it('imports useState for homepage tabs and the quick result finder', () => {
    expect(homePage).toContain("import React, { useMemo, useState } from 'react'");
    expect(homePage).toContain("useState<string>('ALL')");
    expect(homePage).toContain('setFinderHasSearched');
  });

  it('uses the shared PublicLayout in full-bleed mode without nesting main elements', () => {
    expect(homePage).toContain('<PublicLayout fullBleed>');
    expect(homePage).toContain('<div className="w-full">');
    expect(homePage).not.toContain('<main className="w-full">');
    expect(publicLayout).toContain('fullBleed?: boolean');
    expect(publicLayout).toContain("fullBleed\n            ? 'pb-24 lg:pb-0'");
  });

  it('keeps the homepage hero date and venue details while removing its duplicate header', () => {
    expect(homePage).toContain('{formattedDates}');
    expect(homePage).toContain('{formattedDays}');
    expect(homePage).not.toContain('Toggle navigation menu');
    expect(homePage).not.toContain('Mobile Fixed Bottom Navigation Bar');
  });
});


describe('Public header brand typography', () => {
  const publicLayout = readProjectFile('src/components/layout/PublicLayout.tsx');

  it('shows only the festival title in the public header, without institution details', () => {
    expect(publicLayout).toContain('festivalDisplayName');
    expect(publicLayout).not.toContain('theme.institutionName');
    expect(publicLayout).not.toContain('public-brand-subtitle');
    expect(publicLayout).not.toContain('Institution unavailable');
  });

  it('uses larger responsive festival title typography while preserving the Participant Login action', () => {
    expect(publicLayout).toContain('text-xl sm:text-2xl lg:text-3xl');
    expect(publicLayout).toContain('max-w-[55vw] lg:max-w-[24vw] truncate');
    expect(publicLayout).toContain('href="/participant/login"');
    expect(publicLayout).toContain('<UserRound');
  });
});


describe('Public icon, typography, and configured identity', () => {
  const iconFile = readProjectFile('src/components/layout/PublicIcon.tsx');
  const publicCss = readProjectFile('src/app/public/public.css');
  const publicFiles = [
    'src/app/public/page.tsx',
    'src/app/public/directory/page.tsx',
    'src/app/public/championship/page.tsx',
    'src/app/public/competition/[id]/page.tsx',
    'src/components/layout/PublicLayout.tsx',
    'src/components/domain/ChampionshipPodium.tsx',
  ];

  it('renders public icons through Lucide SVG components, not font ligatures', () => {
    expect(iconFile).toContain("from 'lucide-react'");
    for (const path of publicFiles) {
      expect(readProjectFile(path)).not.toContain('material-symbols-outlined');
    }
    expect(publicCss).not.toContain('Material Symbols Outlined');
  });

  it('uses Sora for public text and retains the Admin-selected festival-name font', () => {
    expect(publicCss).toContain("font-family: 'Sora', sans-serif !important");
    expect(publicCss).toContain('var(--festival-name-font');
    expect(publicCss).not.toContain('Cinzel');
    expect(publicCss).not.toContain('Playfair Display');
  });

  it('formats the Festival Settings date range without a hardcoded default', () => {
    expect(iconFile).toContain('formatPublicFestivalDates');
    expect(iconFile).toContain('Dates to be announced');
    expect(readProjectFile('src/app/public/page.tsx')).toContain('theme.institutionName');
    expect(readProjectFile('src/app/public/championship/page.tsx')).toContain('theme.institutionName');
    expect(readProjectFile('src/components/layout/PublicLayout.tsx')).toContain('theme.festivalStartDate');
  });
});


describe('Public homepage institution identity, venue, and theme artwork', () => {
  const homePage = readProjectFile('src/app/public/page.tsx');
  const publicCss = readProjectFile('src/app/public/public.css');

  it('shows the configured institution name in the box above the theme title', () => {
    expect(homePage).toContain("{theme.institutionName?.trim() || 'Institution details to be announced'}");
    expect(homePage).not.toContain("{theme.festivalName?.trim() || 'Official Festival'}");
  });

  it('shows the requested campus location beneath the theme title', () => {
    expect(homePage).toContain('Madin Suffa Campus<br />Vavoor Edavannapara');
  });

  it('removes the shadow from the theme title PNG', () => {
    expect(homePage).not.toContain('theme-glow');
    expect(homePage).not.toContain("filter: 'drop-shadow");
    expect(publicCss).not.toContain('.theme-glow');
  });
});
