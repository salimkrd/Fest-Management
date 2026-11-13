import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { getParticipantSession } from '@/services/participantPortalAuth';
import { getAdminDb, getAdminStorage, syncWorkloadIdentityToken } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: 'png', signature: (b: Buffer) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', signature: (b: Buffer) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }
} as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!/^part-[a-zA-Z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid participant ID.' }, { status: 400 });
    }

    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    await syncWorkloadIdentityToken();
    const db = getAdminDb();
    const storage = getAdminStorage();
    if (!db || !storage) {
      return NextResponse.json({ error: 'Photo storage is currently unavailable.' }, { status: 503 });
    }

    const participantRef = db.collection('participants').doc(id);
    const participantSnap = await participantRef.get();
    if (!participantSnap.exists) {
      return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
    }
    const participant = participantSnap.data()!;
    const authorization = req.headers.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    if (idToken) {
      await AuthService.assertTeamManager(idToken, String(participant.teamId || ''));
    } else {
      const session = await getParticipantSession(req);
      if (!session || session.id !== id) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      }
    }

    const form = await req.formData();
    const upload = form.get('photo');
    if (!(upload instanceof File)) {
      return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 });
    }
    if (upload.size < 1 || upload.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo must be smaller than 5 MB.' }, { status: 400 });
    }

    const mime = upload.type.toLowerCase();
    const definition = PHOTO_TYPES[mime as keyof typeof PHOTO_TYPES];
    if (!definition) {
      return NextResponse.json({ error: 'Use a JPG, PNG, or WebP image.' }, { status: 400 });
    }

    const bytes = Buffer.from(await upload.arrayBuffer());
    if (bytes.length !== upload.size || !definition.signature(bytes)) {
      return NextResponse.json({ error: 'The selected file is not a valid image of the declared type.' }, { status: 400 });
    }

    const bucket = storage.bucket();
    if (!bucket.name) {
      return NextResponse.json({ error: 'Firebase Storage bucket is not configured.' }, { status: 503 });
    }

    const filePath = `participants/${id}/${randomUUID()}.${definition.extension}`;
    const downloadToken = randomUUID();
    const object = bucket.file(filePath);
    await object.save(bytes, {
      resumable: false,
      metadata: {
        contentType: mime,
        cacheControl: 'private, max-age=3600',
        metadata: { firebaseStorageDownloadTokens: downloadToken }
      }
    });

    const photoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
    await participantRef.update({
      photoUrl,
      photoUpdatedAt: new Date().toISOString(),
      photoStoragePath: filePath
    });

    return NextResponse.json({ success: true, photoUrl }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[ParticipantPhotoUpload] Upload failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not upload the participant photo. Please retry.' }, { status: 500 });
  }
}
