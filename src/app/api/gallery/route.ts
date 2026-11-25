import { NextRequest, NextResponse } from 'next/server';
import { syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { GalleryService } from '@/services/galleryService';
import { AuthService } from '@/services/authService';
import { isGalleryAlbumId } from '@/domain/gallery';

export const runtime = 'nodejs';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store, max-age=0' };
const publicCache = { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300' };

const IMAGE_TYPES = {
  'image/jpeg': {
    extension: 'jpg' as const,
    signature: (bytes: Buffer) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  'image/png': {
    extension: 'png' as const,
    signature: (bytes: Buffer) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp' as const,
    signature: (bytes: Buffer) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
  },
} as const;

function adminToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || !header.slice(7).trim()) {
    throw new Error('Unauthorized: Administrator authentication is required.');
  }
  return header.slice(7).trim();
}

function verifyOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    throw new Error('Unauthorized: Invalid request origin.');
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Gallery request failed.';
  const lower = message.toLowerCase();
  const status = lower.includes('unauthorized') || lower.includes('security violation')
    ? 403
    : lower.includes('validation error')
      ? 400
      : lower.includes('not found')
        ? 404
        : lower.includes('unavailable') || lower.includes('not configured')
          ? 503
          : 500;
  if (status === 500) console.error('[Gallery API]', message);
  return NextResponse.json(
    { error: status === 500 ? 'The gallery request could not be completed.' : message },
    { status, headers: noStore },
  );
}

export async function GET(request: NextRequest) {
  try {
    await syncWorkloadIdentityToken();
    const params = request.nextUrl.searchParams;
    const manage = params.get('manage') === '1';
    const albumValue = params.get('albumId') || '';
    const albumId = albumValue && isGalleryAlbumId(albumValue) ? albumValue : undefined;
    if (albumValue && !albumId) {
      return NextResponse.json({ error: 'Choose a valid gallery album.' }, { status: 400, headers: noStore });
    }
    if (manage) {
      const token = adminToken(request);
      // Verify administrator privileges before reading draft or archived records.
      await AuthService.assertAdmin(token);
      const result = await GalleryService.list({
        includeUnpublished: true,
        ...(albumId ? { albumId } : {}),
        limit: 1000,
      });
      return NextResponse.json(result, { headers: noStore });
    }

    const offsetValue = Number(params.get('offset') || 0);
    const limitValue = Number(params.get('limit') || 12);
    const offset = Number.isSafeInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0;
    const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? Math.min(48, limitValue) : 12;
    const result = await GalleryService.list({
      includeUnpublished: false,
      ...(albumId ? { albumId } : {}),
      offset,
      limit,
    });
    const images = result.images.map(({ id, albumId, title, caption, altText, imageUrl, createdAt }) => ({
      id, albumId, title, caption, altText, imageUrl, createdAt,
    }));
    return NextResponse.json({ ...result, images }, { headers: publicCache });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    verifyOrigin(request);
    await syncWorkloadIdentityToken();
    const token = adminToken(request);
    const form = await request.formData();
    const upload = form.get('image');
    if (!(upload instanceof File)) {
      return NextResponse.json({ error: 'Choose one image to upload.' }, { status: 400, headers: noStore });
    }
    if (upload.size < 1 || upload.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Each image must be smaller than 4 MB.' }, { status: 400, headers: noStore });
    }

    const mimeType = upload.type.toLowerCase();
    const definition = IMAGE_TYPES[mimeType as keyof typeof IMAGE_TYPES];
    if (!definition) {
      return NextResponse.json({ error: 'Use a JPG, PNG, or WebP image.' }, { status: 400, headers: noStore });
    }
    const bytes = Buffer.from(await upload.arrayBuffer());
    if (bytes.length !== upload.size || !definition.signature(bytes)) {
      return NextResponse.json({ error: 'The selected file is not a valid image of its declared type.' }, { status: 400, headers: noStore });
    }

    const image = await GalleryService.createDraft(token, {
      bytes,
      mimeType,
      extension: definition.extension,
      albumId: form.get('albumId'),
      title: form.get('title'),
      caption: form.get('caption') || '',
      altText: form.get('altText') || form.get('title'),
    });
    return NextResponse.json({ image }, { status: 201, headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    verifyOrigin(request);
    await syncWorkloadIdentityToken();
    const token = adminToken(request);
    const body = await request.json() as Record<string, unknown>;
    const image = await GalleryService.update(token, body.id, body);
    return NextResponse.json({ image }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    verifyOrigin(request);
    await syncWorkloadIdentityToken();
    const token = adminToken(request);
    await GalleryService.delete(token, request.nextUrl.searchParams.get('id'));
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
