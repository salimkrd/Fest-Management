import { NextRequest, NextResponse } from 'next/server';
import { PARTICIPANT_COOKIE_NAME, PARTICIPANT_COOKIE_OPTIONS } from '@/services/participantPortalAuth';

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(PARTICIPANT_COOKIE_NAME, '', { ...PARTICIPANT_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
