import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AuthService } from '@/services/authService';
import { getAdminStorage, syncWorkloadIdentityToken } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

const ALLOWED = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]);
const MAX_BYTES = 5 * 1024 * 1024;

/** Authenticated Chief Admin upload. Firebase Admin SDK bypasses client Storage Rules,
 * while verified role, type, size and authoritative user checks remain mandatory. */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Administrator login required.' }, { status: 401 });
    await syncWorkloadIdentityToken();
    await AuthService.assertAdmin(authorization.slice(7).trim());

    const type = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const extension = ALLOWED.get(type);
    if (!extension) return NextResponse.json({ error: 'Only PNG, JPEG and WebP logos are allowed.' }, { status: 415 });
    const declaredSize = Number(request.headers.get('content-length') || 0);
    if (declaredSize > MAX_BYTES) return NextResponse.json({ error: 'Logo must be smaller than 5 MB.' }, { status: 413 });
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length >= MAX_BYTES) return NextResponse.json({ error: 'Logo must be nonempty and smaller than 5 MB.' }, { status: 413 });

    const isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    if (!(type === 'image/png' && isPng || type === 'image/jpeg' && isJpeg || type === 'image/webp' && isWebp)) {
      return NextResponse.json({ error: 'File content does not match the image type.' }, { status: 415 });
    }

    const storage = getAdminStorage();
    if (!storage) return NextResponse.json({ error: 'Server Storage is not configured.' }, { status: 503 });
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) return NextResponse.json({ error: 'Storage bucket configuration missing.' }, { status: 503 });
    const bucket = storage.bucket(bucketName);
    const path = 'branding/festival-logo-' + randomUUID() + '.' + extension;
    const downloadToken = randomUUID();
    await bucket.file(path).save(bytes, {
      resumable: false,
      contentType: type,
      metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken }, cacheControl: 'public,max-age=3600' }
    });
    const url = 'https://firebasestorage.googleapis.com/v0/b/' + encodeURIComponent(bucketName) + '/o/' + encodeURIComponent(path) + '?alt=media&token=' + downloadToken;
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logo upload failed.';
    const unauthorized = /unauthorized|invalid.*token|insufficient permissions|role mismatch|requires ADMIN|disabled|not active/i.test(message);
    console.error('[Festival logo upload]', error);
    return NextResponse.json({ error: unauthorized ? 'Administrator verification failed. Sign out and sign in again.' : 'Server upload failed. Check Firebase Admin Storage access and bucket configuration.' }, { status: unauthorized ? 403 : 503 });
  }
}
