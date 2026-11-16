import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nextConfig from '../../next.config';
import { UNIFIED_STAFF_LOGIN_ROUTE } from '../lib/authRoutes';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Public homepage and legacy staff routing', () => {
  it('permanently redirects the legacy /public homepage to / without redirecting child routes', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({ source: '/public', destination: '/', permanent: true });
    expect(redirects).not.toContainEqual(expect.objectContaining({ source: '/public/:path*' }));
  });

  it('safely redirects legacy staff entry points to the unified staff login route', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({
      source: '/admin/login',
      destination: UNIFIED_STAFF_LOGIN_ROUTE,
      permanent: false,
    });
    expect(redirects).toContainEqual({
      source: '/team/login',
      destination: UNIFIED_STAFF_LOGIN_ROUTE,
      permanent: false,
    });
    expect(redirects).toContainEqual({
      source: '/management',
      destination: UNIFIED_STAFF_LOGIN_ROUTE,
      permanent: false,
    });
  });

  it('retires the old management portal hub and redirects to unified login', () => {
    expect(source('src/app/page.tsx')).toContain("export { default } from './public/page'");
    const managementSource = source('src/app/management/page.tsx');
    expect(managementSource).not.toContain('Management System');
    expect(managementSource).not.toContain('Admin Control Center');
    expect(managementSource).toContain('buildStaffLoginUrl');
    expect(managementSource).toContain('redirect(');
  });

  it('keeps dedicated public result routes and correct homepage navigation', () => {
    const layout = source('src/components/layout/PublicLayout.tsx');
    expect(layout).toContain("{ name: 'Latest Results', href: '/'");
    expect(layout).not.toContain('href="/management"');
    expect(layout).toContain("href: '/public/directory'");
    expect(layout).toContain("href: '/public/championship'");
  });
});
