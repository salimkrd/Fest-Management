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
    expect(publicLayout).toContain('theme.institutionName');
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
