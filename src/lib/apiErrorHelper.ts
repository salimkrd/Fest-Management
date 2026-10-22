import { NextResponse } from 'next/server';

/**
 * Maps error messages and exceptions to structured JSON responses with appropriate HTTP status codes.
 * Enforces:
 * - 401 Unauthorized for missing, expired, or invalid/malformed authentication tokens.
 * - 403 Forbidden for authenticated callers with insufficient roles or privileges.
 * - 400 Bad Request for validation errors.
 * - 404 Not Found for nonexistent resources.
 * - 500 Internal Server Error for unhandled exceptions.
 * Never leaks raw stack traces or internal implementation details.
 */
export function handleApiError(err: any): NextResponse {
  const rawMessage: string = err?.message || 'Internal Server Error';
  const lower = rawMessage.toLowerCase();

  // 1. Authentication failures (Missing, Expired, Malformed, or Argument Error)
  if (
    lower.includes('missing administrator authentication token') ||
    lower.includes('missing or invalid authentication token') ||
    lower.includes('invalid or malformed authentication token') ||
    lower.includes('token has expired') ||
    lower.includes('token verification failed') ||
    lower.includes('auth/argument-error') ||
    lower.includes('auth/id-token-expired') ||
    lower.includes('auth/invalid-id-token') ||
    lower.includes('auth/user-token-expired')
  ) {
    const cleanError = lower.includes('expired')
      ? 'Unauthorized: Authentication token has expired. Please sign in again.'
      : 'Unauthorized: Invalid or malformed authentication token.';
    return NextResponse.json({ error: cleanError }, { status: 401 });
  }

  // 2. Authorization failures (Role mismatch, privilege escalation, cross-team access)
  if (
    lower.includes('requires admin role') ||
    lower.includes('cross-team access denied') ||
    lower.includes('security violation') ||
    lower.includes('unauthorized') ||
    lower.includes('disabled by fest administration')
  ) {
    return NextResponse.json({ error: rawMessage }, { status: 403 });
  }

  // 3. Validation failures
  if (lower.includes('validation error') || lower.includes('required')) {
    return NextResponse.json({ error: rawMessage }, { status: 400 });
  }

  // 4. Resource Not Found
  if (lower.includes('not found') || lower.includes('does not exist')) {
    return NextResponse.json({ error: rawMessage }, { status: 404 });
  }

  // 5. General Server Error
  return NextResponse.json({ error: rawMessage }, { status: 500 });
}
