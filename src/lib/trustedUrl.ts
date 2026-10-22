import { NextRequest } from 'next/server';

/**
 * Resolves the trusted application base URL for secure activation and onboarding links.
 * 
 * Strict Security Invariants:
 * 1. In production, requires an explicitly configured, trusted HTTPS application base URL (NEXT_PUBLIC_APP_URL or APP_URL).
 * 2. Strictly prohibits trusting arbitrary forwarded host headers in production to eliminate Host Header Injection vulnerabilities.
 * 3. Enforces HTTPS protocol in production.
 * 4. Permits safe localhost/emulator fallbacks in development and test environments.
 */
export function getTrustedAppUrl(req?: NextRequest): string {
  const isProd = process.env.NODE_ENV === 'production';
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  if (configured && configured.trim() !== '') {
    const trimmed = configured.trim().replace(/\/+$/, '');
    if (isProd && !trimmed.startsWith('https://')) {
      throw new Error('Security Violation: In production, NEXT_PUBLIC_APP_URL or APP_URL must use HTTPS protocol.');
    }
    return trimmed;
  }

  if (isProd) {
    throw new Error('Configuration Error: In production, trusted application URL (NEXT_PUBLIC_APP_URL or APP_URL) must be explicitly configured. Arbitrary forwarded host headers are strictly rejected.');
  }

  // Development and test environments only: safe local fallback
  if (req) {
    const host = req.headers.get('host');
    if (host) {
      const proto = req.headers.get('x-forwarded-proto') || 'http';
      return `${proto}://${host}`;
    }
  }

  return 'http://localhost:3000';
}
