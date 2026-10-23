import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/apiErrorHelper';

export const privateHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export function adminToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || !header.slice(7).trim()) {
    throw new Error('Unauthorized: Missing administrator authentication token.');
  }
  return header.slice(7).trim();
}

export async function posterBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 1_000_000) throw new Error('Validation error: Poster data is too large.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Validation error: Invalid JSON request.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Validation error: A JSON object is required.');
  }
  return value as Record<string, unknown>;
}

export function posterError(error: unknown) {
  if (error instanceof Error && error.message.startsWith('Invalid ')) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: privateHeaders });
  }
  const response = handleApiError(error);
  response.headers.set('Cache-Control', privateHeaders['Cache-Control']);
  return response;
}
