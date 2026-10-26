import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { getParticipantSession } from '@/services/participantPortalAuth';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { loadParticipantPhotoForExport } from '@/services/participantPhotoExportService';

/**
 * Same-origin authenticated photo endpoint for browser canvas export.
 * Resolves photoUrl from the authoritative participant record, not a caller
 * supplied URL. Both staff and participant sessions obey existing role checks.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^part-[a-zA-Z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid participant ID.' }, { status: 400 });
    }
    const bearer = req.headers.get('authorization') || '';
    const idToken = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
    let photoUrl: string | undefined;

    if (idToken) {
      await syncWorkloadIdentityToken();
      const db = getAdminDb();
      if (!db) throw new Error('Participant database unavailable.');
      const participantDoc = await db.collection('participants').doc(id).get();
      if (!participantDoc.exists) return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
      const data = participantDoc.data()!;
      await AuthService.assertTeamManager(idToken, data.teamId || '');
      photoUrl = data.photoUrl;
    } else {
      const session = await getParticipantSession(req);
      if (!session || session.id !== id) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
      photoUrl = session.data.photoUrl;
    }

    if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.includes('1534528741775-53994a69daeb')) {
      return NextResponse.json({ error: 'Participant has no uploaded photo.' }, { status: 404 });
    }

    const image = await loadParticipantPhotoForExport(photoUrl);
    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err) {
    console.warn('[ParticipantPhotoExport] Could not retrieve photo:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Unable to securely retrieve participant photo for PNG export.' }, { status: 502 });
  }
}
