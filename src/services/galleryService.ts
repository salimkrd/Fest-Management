import { randomUUID } from 'node:crypto';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';
import { isGalleryAlbumId, isGalleryStatus, type GalleryAlbumId, type GalleryImage, type GalleryStatus } from '@/domain/gallery';

function database() {
  const db = getAdminDb();
  if (!db) throw new Error('Gallery database is unavailable. Please try again later.');
  return db;
}

function cleanText(value: unknown, label: string, maxLength: number, required = false): string {
  if (typeof value !== 'string') throw new Error(`Validation error: ${label} must be text.`);
  const text = value.trim();
  if (required && !text) throw new Error(`Validation error: ${label} is required.`);
  if (text.length > maxLength) throw new Error(`Validation error: ${label} must be ${maxLength} characters or fewer.`);
  return text;
}

function toGalleryImage(id: string, data: FirebaseFirestore.DocumentData): GalleryImage | null {
  if (
    !isGalleryAlbumId(data.albumId) ||
    !isGalleryStatus(data.status) ||
    typeof data.title !== 'string' ||
    typeof data.imageUrl !== 'string' ||
    typeof data.storagePath !== 'string'
  ) return null;

  return {
    id,
    albumId: data.albumId,
    title: data.title,
    caption: typeof data.caption === 'string' ? data.caption : '',
    altText: typeof data.altText === 'string' ? data.altText : data.title,
    imageUrl: data.imageUrl,
    storagePath: data.storagePath,
    status: data.status,
    mimeType: typeof data.mimeType === 'string' ? data.mimeType : 'image/jpeg',
    fileSize: typeof data.fileSize === 'number' ? data.fileSize : 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    uploadedBy: typeof data.uploadedBy === 'string' ? data.uploadedBy : '',
    ...(typeof data.updatedBy === 'string' ? { updatedBy: data.updatedBy } : {}),
  };
}

export class GalleryService {
  static async list(options: {
    includeUnpublished?: boolean;
    albumId?: GalleryAlbumId;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ images: GalleryImage[]; total: number; nextOffset: number; hasMore: boolean }> {
    const collection = database().collection('galleryImages');
    const snapshot = options.includeUnpublished
      ? await collection.get()
      : await collection.where('status', '==', 'PUBLISHED').get();

    const all = snapshot.docs
      .map(doc => toGalleryImage(doc.id, doc.data()))
      .filter((item): item is GalleryImage => Boolean(item))
      .filter(item => !options.albumId || item.albumId === options.albumId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = Math.max(0, options.offset || 0);
    const limit = Math.max(1, Math.min(48, options.limit || 12));
    const images = all.slice(offset, offset + limit);
    const nextOffset = offset + images.length;

    return { images, total: all.length, nextOffset, hasMore: nextOffset < all.length };
  }

  static async createDraft(
    adminIdToken: string,
    input: {
      bytes: Buffer;
      mimeType: string;
      extension: 'jpg' | 'png' | 'webp';
      albumId: unknown;
      title: unknown;
      caption: unknown;
      altText: unknown;
    },
  ): Promise<GalleryImage> {
    const admin = await AuthService.assertAdmin(adminIdToken);
    if (!isGalleryAlbumId(input.albumId)) throw new Error('Validation error: Choose a valid gallery album.');

    const title = cleanText(input.title, 'Photo title', 100, true);
    const caption = cleanText(input.caption ?? '', 'Caption', 300);
    const altText = cleanText(input.altText || title, 'Alternative text', 300, true);
    if (!input.bytes.length) throw new Error('Validation error: The selected image is empty.');

    const storage = getAdminStorage();
    if (!storage) throw new Error('Gallery image storage is unavailable. Please try again later.');
    const bucket = storage.bucket();
    if (!bucket.name) throw new Error('Gallery image storage bucket is not configured.');

    const id = randomUUID();
    const storagePath = `gallery/${input.albumId}/${id}.${input.extension}`;
    const downloadToken = randomUUID();
    const object = bucket.file(storagePath);
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
    const now = new Date().toISOString();

    await object.save(input.bytes, {
      resumable: false,
      metadata: {
        contentType: input.mimeType,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const record = {
      albumId: input.albumId,
      title,
      caption,
      altText,
      imageUrl,
      storagePath,
      status: 'DRAFT' as const,
      mimeType: input.mimeType,
      fileSize: input.bytes.length,
      createdAt: now,
      updatedAt: now,
      uploadedBy: admin.uid,
    };

    try {
      await database().collection('galleryImages').doc(id).set(record);
    } catch (error) {
      await object.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }

    return { id, ...record };
  }

  static async update(
    adminIdToken: string,
    idValue: unknown,
    input: {
      albumId?: unknown;
      title?: unknown;
      caption?: unknown;
      altText?: unknown;
      status?: unknown;
    },
  ): Promise<GalleryImage> {
    const admin = await AuthService.assertAdmin(adminIdToken);
    if (typeof idValue !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(idValue)) {
      throw new Error('Validation error: Invalid gallery image ID.');
    }

    const ref = database().collection('galleryImages').doc(idValue);
    const existing = await ref.get();
    if (!existing.exists) throw new Error('Gallery image not found.');

    const updates: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(input, 'albumId')) {
      if (!isGalleryAlbumId(input.albumId)) throw new Error('Validation error: Choose a valid gallery album.');
      updates.albumId = input.albumId;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'title')) updates.title = cleanText(input.title, 'Photo title', 100, true);
    if (Object.prototype.hasOwnProperty.call(input, 'caption')) updates.caption = cleanText(input.caption, 'Caption', 300);
    if (Object.prototype.hasOwnProperty.call(input, 'altText')) updates.altText = cleanText(input.altText, 'Alternative text', 300, true);
    if (Object.prototype.hasOwnProperty.call(input, 'status')) {
      if (!isGalleryStatus(input.status)) throw new Error('Validation error: Choose a valid photo status.');
      updates.status = input.status;
    }
    if (!Object.keys(updates).length) throw new Error('Validation error: No gallery changes were supplied.');

    updates.updatedAt = new Date().toISOString();
    updates.updatedBy = admin.uid;
    await ref.update(updates);

    const updated = await ref.get();
    const image = toGalleryImage(updated.id, updated.data()!);
    if (!image) throw new Error('Gallery image could not be read after saving.');
    return image;
  }

  static async delete(adminIdToken: string, idValue: unknown): Promise<void> {
    await AuthService.assertAdmin(adminIdToken);
    if (typeof idValue !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(idValue)) {
      throw new Error('Validation error: Invalid gallery image ID.');
    }

    const db = database();
    const ref = db.collection('galleryImages').doc(idValue);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('Gallery image not found.');

    const storagePath = snapshot.data()?.storagePath;
    if (typeof storagePath === 'string' && storagePath.startsWith('gallery/')) {
      const storage = getAdminStorage();
      if (storage) await storage.bucket().file(storagePath).delete({ ignoreNotFound: true });
    }
    await ref.delete();
  }
}
