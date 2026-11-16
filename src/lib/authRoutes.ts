/**
 * Canonical configuration for staff authentication routes.
 * Unified staff authentication replaces legacy /admin/login, /team/login, and /management routes.
 */

export const UNIFIED_STAFF_LOGIN_ROUTE = '/x/k9m2v7q4p8b1a5d6';

export const RETIRED_STAFF_LOGIN_ROUTES = [
  '/admin/login',
  '/team/login',
  '/management',
] as const;

/**
 * Builds the unified staff login URL with optional query parameters preserved.
 */
export function buildStaffLoginUrl(params?: {
  email?: string | null;
  onboarding?: string | null;
  error?: string | null;
  redirect?: string | null;
  [key: string]: string | null | undefined;
}): string {
  if (!params) return UNIFIED_STAFF_LOGIN_ROUTE;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `${UNIFIED_STAFF_LOGIN_ROUTE}?${query}` : UNIFIED_STAFF_LOGIN_ROUTE;
}
