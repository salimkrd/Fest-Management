import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Participant login public-theme redesign', () => {
  const page = readProjectFile('src/app/participant/login/page.tsx');
  const styles = readProjectFile('src/app/participant/login/participant-login.css');

  it('uses the public palette and Sora only inside the participant login experience', () => {
    expect(page).toContain("import './participant-login.css'");
    expect(page).toContain('className="participant-login"');
    expect(styles).toContain('#4A0A1C');
    expect(styles).toContain('#BA1912');
    expect(styles).toContain('#FDBF0F');
    expect(styles).toContain('#1B090B');
    expect(styles).toContain("font-family: 'Sora', sans-serif");
    expect(styles).toContain('.participant-login');
  });

  it('renders festival identity from Festival Settings and retains the status and home actions', () => {
    expect(page).toContain('theme.festivalName');
    expect(page).toContain('theme.institutionName');
    expect(page).toContain('<FestivalLogo');
    expect(page).toContain('<FestivalStatusBadge');
    expect(page).toContain('href="/"');
  });

  it('preserves the participant credentials, validation, API request, and redirect flow', () => {
    expect(page).toContain('id="participant-bib"');
    expect(page).toContain('id="participant-dob"');
    expect(page).toContain('required');
    expect(page).toContain("fetch('/api/participant/login'");
    expect(page).toContain("body: JSON.stringify({ bib: bib.trim(), dob })");
    expect(page).toContain("router.replace('/participant')");
    expect(page).toContain('setSubmitting(false)');
    expect(page).toContain('role="alert"');
  });

  it('includes a single-column mobile layout and accessible reduced-motion support', () => {
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(page).toContain('aria-label="Participant login navigation"');
    expect(page).toContain('aria-labelledby="participant-login-title"');
  });
});
