export const GALLERY_ALBUMS = [
  { id: 'inauguration', name: 'Inauguration' },
  { id: 'competitions', name: 'Competitions' },
  { id: 'stage-moments', name: 'Stage Moments' },
  { id: 'guests-scholars', name: 'Guests & Scholars' },
  { id: 'campus-life', name: 'Campus Life' },
  { id: 'behind-the-scenes', name: 'Behind the Scenes' },
  { id: 'awards-closing', name: 'Awards & Closing' },
] as const;

export type GalleryAlbumId = (typeof GALLERY_ALBUMS)[number]['id'];
export type GalleryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface GalleryImage {
  id: string;
  albumId: GalleryAlbumId;
  title: string;
  caption: string;
  altText: string;
  imageUrl: string;
  storagePath: string;
  status: GalleryStatus;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy: string;
  updatedBy?: string;
}

export type PublicGalleryImage = Pick<
  GalleryImage,
  'id' | 'albumId' | 'title' | 'caption' | 'altText' | 'imageUrl' | 'createdAt'
>;

export function isGalleryAlbumId(value: unknown): value is GalleryAlbumId {
  return typeof value === 'string' && GALLERY_ALBUMS.some(album => album.id === value);
}

export function isGalleryStatus(value: unknown): value is GalleryStatus {
  return value === 'DRAFT' || value === 'PUBLISHED' || value === 'ARCHIVED';
}
