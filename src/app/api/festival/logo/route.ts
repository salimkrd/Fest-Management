import { NextResponse } from 'next/server';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { loadParticipantPhotoForExport } from '@/services/participantPhotoExportService';

/** Public same-origin copy of the authoritative festival logo for clean canvas exports.
 * It accepts no user supplied URL, and reuses SSRF-hardened pinned HTTPS fetching.
 */
export async function GET() {
  try {
    await syncWorkloadIdentityToken();
    const db = getAdminDb();
    if (!db) throw new Error('Database unavailable');
    const snapshot = await db.collection('settings').doc('publicTheme').get();
    const logoUrl = snapshot.data()?.logoUrl;
    if (!logoUrl || typeof logoUrl !== 'string') {
      return NextResponse.json({ error: 'Festival logo not configured.' }, { status: 404 });
    }
    const logo = await loadParticipantPhotoForExport(logoUrl);
    return new NextResponse(new Uint8Array(logo.bytes), {
      headers: { 'Content-Type': logo.contentType, 'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=30', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch {
    return NextResponse.json({ error: 'Festival logo is unavailable for export.' }, { status: 503 });
  }
}
