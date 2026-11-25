'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { GALLERY_ALBUMS, type PublicGalleryImage } from '@/domain/gallery';
import { ArrowLeft, ArrowRight, Camera, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, X } from 'lucide-react';

interface GalleryResponse {
  images: PublicGalleryImage[];
  total: number;
  nextOffset: number;
  hasMore: boolean;
}

export default function PublicGalleryPage() {
  const [selectedAlbum, setSelectedAlbum] = useState('ALL');
  const [images, setImages] = useState<PublicGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fetchGallery = useCallback(async (offset: number, append: boolean) => {
    const params = new URLSearchParams({ offset: String(offset), limit: '12' });
    if (selectedAlbum !== 'ALL') params.set('albumId', selectedAlbum);
    const response = await fetch(`/api/gallery?${params.toString()}`, { cache: 'no-store' });
    const payload = await response.json() as GalleryResponse & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Gallery photos could not be loaded.');
    setImages(current => append ? [...current, ...payload.images] : payload.images);
    setHasMore(payload.hasMore);
    setNextOffset(payload.nextOffset);
  }, [selectedAlbum]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setActiveIndex(null);
    const params = new URLSearchParams({ offset: '0', limit: '12' });
    if (selectedAlbum !== 'ALL') params.set('albumId', selectedAlbum);
    fetch(`/api/gallery?${params.toString()}`, { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json() as GalleryResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Gallery photos could not be loaded.');
        if (!active) return;
        setImages(payload.images);
        setHasMore(payload.hasMore);
        setNextOffset(payload.nextOffset);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Gallery photos could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedAlbum]);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowRight') setActiveIndex(current => current === null ? null : (current + 1) % images.length);
      if (event.key === 'ArrowLeft') setActiveIndex(current => current === null ? null : (current - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, images.length]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError('');
    try {
      await fetchGallery(nextOffset, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'More photos could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  };

  const activeImage = activeIndex === null ? null : images[activeIndex];

  return (
    <PublicLayout>
      <div className="public-page-stack mx-auto w-full max-w-7xl space-y-7 sm:space-y-9">
        <section className="relative overflow-hidden rounded-2xl border border-[#BA1912]/35 bg-gradient-to-b from-[#230D0F] via-[#1B090B] to-[#120507] px-5 py-10 text-center shadow-2xl sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-[760px] -translate-x-1/2 rounded-full bg-[#BA1912]/20 blur-[110px]" />
          <div className="pointer-events-none absolute right-8 top-8 h-56 w-56 rounded-full bg-[#FDBF0F]/10 blur-[90px]" />
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FDBF0F]/35 bg-[#1B090B]/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FDBF0F] sm:text-xs">
              <Camera className="h-4 w-4" />
              <span>IN PICTURES</span>
            </div>
            <h1 className="text-3xl font-extrabold uppercase tracking-[0.08em] text-[#F2F3E6] sm:text-5xl">Gallery</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#F2F3E6]/70 sm:text-base">
              Moments, memories and highlights from INSPIRATH — captured across the festival.
            </p>
            <div className="mt-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FDBF0F]/75">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#FDBF0F]/70" />
              <span>Proactive Paradigms</span>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#FDBF0F]/70" />
            </div>
          </div>
        </section>

        <section aria-label="Gallery photos" className="space-y-5">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
            <button
              type="button"
              onClick={() => setSelectedAlbum('ALL')}
              aria-pressed={selectedAlbum === 'ALL'}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors ${selectedAlbum === 'ALL' ? 'border-[#FDBF0F] bg-[#FDBF0F] text-[#1A080B]' : 'border-[#FDBF0F]/25 bg-[#230D0F] text-[#F2F3E6]/75 hover:border-[#FDBF0F]/60 hover:text-[#FDBF0F]'}`}
            >
              All Photos
            </button>
            {GALLERY_ALBUMS.map(album => (
              <button
                key={album.id}
                type="button"
                onClick={() => setSelectedAlbum(album.id)}
                aria-pressed={selectedAlbum === album.id}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors ${selectedAlbum === album.id ? 'border-[#FDBF0F] bg-[#FDBF0F] text-[#1A080B]' : 'border-[#FDBF0F]/25 bg-[#230D0F] text-[#F2F3E6]/75 hover:border-[#FDBF0F]/60 hover:text-[#FDBF0F]'}`}
              >
                {album.name}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">{error}</div>
          )}

          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-[#F2F3E6]/60">
              <Loader2 className="h-5 w-5 animate-spin text-[#FDBF0F]" /> Loading gallery…
            </div>
          ) : images.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#FDBF0F]/25 bg-[#230D0F]/50 px-6 text-center">
              <ImageIcon className="h-10 w-10 text-[#FDBF0F]/55" />
              <h2 className="mt-4 text-base font-bold text-[#F2F3E6]">Photos are being added</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#F2F3E6]/55">
                Published festival photographs will appear here. Please check back soon.
              </p>
            </div>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`View photo: ${image.title}`}
                  className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-[#FDBF0F]/10 bg-[#230D0F] text-left shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDBF0F]"
                >
                  <img
                    src={image.imageUrl}
                    alt={image.altText || image.title}
                    loading="lazy"
                    decoding="async"
                    className="block h-auto max-h-[560px] w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120507]/90 via-transparent to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
                  <span className="absolute inset-x-0 bottom-0 p-4">
                    <span className="block text-sm font-bold text-white">{image.title}</span>
                    {image.caption && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-white/75">{image.caption}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#FDBF0F]/45 bg-[#230D0F] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[#FDBF0F] transition hover:border-[#FDBF0F] hover:bg-[#FDBF0F] hover:text-[#1A080B] disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownIcon />}
                {loadingMore ? 'Loading…' : 'Load more photos'}
              </button>
            </div>
          )}
        </section>
      </div>

      {activeImage && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#080304]/95 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={event => { if (event.target === event.currentTarget) setActiveIndex(null); }}
        >
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            aria-label="Close photo viewer"
            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveIndex((activeIndex - 1 + images.length) % images.length)}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white hover:bg-white/15 sm:left-6"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((activeIndex + 1) % images.length)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white hover:bg-white/15 sm:right-6"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="flex max-h-full w-full max-w-6xl flex-col items-center justify-center gap-4">
            <img
              src={activeImage.imageUrl}
              alt={activeImage.altText || activeImage.title}
              className="max-h-[76vh] max-w-full object-contain"
              decoding="async"
            />
            <div className="max-w-3xl text-center">
              <p className="text-sm font-bold text-white sm:text-base">{activeImage.title}</p>
              {activeImage.caption && <p className="mt-1 text-xs leading-6 text-white/65 sm:text-sm">{activeImage.caption}</p>}
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-[#FDBF0F]/70">
                {activeIndex + 1} / {images.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

function ArrowDownIcon() {
  return <ArrowRight className="h-4 w-4" />;
}
