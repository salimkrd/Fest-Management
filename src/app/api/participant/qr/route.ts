import { NextRequest, NextResponse } from 'next/server';
import { getParticipantSession } from '@/services/participantPortalAuth';
import { QrSignerService } from '@/services/qrSignerService';

export async function GET(req: NextRequest) {
  try {
    const session = await getParticipantSession(req);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const bib = session.data.bib;
    if (typeof bib !== 'string' || !bib) {
      return NextResponse.json({ error: 'Participant has no assigned bib number.' }, { status: 400 });
    }
    const { token, payload } = QrSignerService.signParticipantQr(session.id, bib);
    return NextResponse.json({ success: true, token, payload, qrPayload: payload }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.warn('[ParticipantPortal] QR issue:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Could not create a verified QR badge.' }, { status: 503 });
  }
}
