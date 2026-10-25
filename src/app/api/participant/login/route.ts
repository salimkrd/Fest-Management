import { NextRequest, NextResponse } from 'next/server';
import { loginParticipant, PARTICIPANT_COOKIE_NAME, PARTICIPANT_COOKIE_OPTIONS } from '@/services/participantPortalAuth';

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const result = await loginParticipant(req, body.participantId, body.dob);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.limited
          ? 'Too many sign-in attempts. Please try again later.'
          : 'Invalid Participant ID or Date of Birth.' },
        { status: result.limited ? 429 : 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(PARTICIPANT_COOKIE_NAME, result.token, PARTICIPANT_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error('[ParticipantPortal] Authentication unavailable:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Participant login is temporarily unavailable.' }, { status: 503 });
  }
}
