import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nextConfig from '../../next.config';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Public homepage and management hub routing', () => {
  it('permanently redirects the legacy /public homepage to / without redirecting child routes', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({ source: '/public', destination: '/', permanent: true });
    expect(redirects).not.toContainEqual(expect.objectContaining({ source: '/public/:path*' }));
  });

  it('renders the existing public results homepage at / and management at /management', () => {
    expect(source('src/app/page.tsx')).toContain("export { default } from './public/page'");
    expect(source('src/app/management/page.tsx')).toContain('Fest Management System');
    expect(source('src/app/management/page.tsx')).toContain('href="/admin"');
  });

  it('keeps dedicated public result routes and correct homepage navigation', () => {
    const layout = source('src/components/layout/PublicLayout.tsx');
    expect(layout).toContain("{ name: 'Latest Results', href: '/'");
    expect(layout).toContain('href="/management"');
    expect(layout).toContain('href="/public/directory"');
    expect(layout).toContain('href="/public/championship"');
  });
});
