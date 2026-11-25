'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { auth } from '@/lib/firebase/client';
import { GALLERY_ALBUMS, type GalleryImage, type GalleryStatus } from '@/domain/gallery';
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, RefreshCw, Save, Trash2, UploadCloud } from 'lucide-react';

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  caption: string;
  altText: string;
}

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export default function GalleryManagerPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const pendingRef = useRef<PendingImage[]>([]);
  const [uploadAlbum, setUploadAlbum] = useState<string>(GALLERY_ALBUMS[0].id);
  const [filterAlbum, setFilterAlbum] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => pendingRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl)), []);

  const getToken = async () => {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Administrator session not found. Please sign in again.');
    return token;
  };

  const loadImages = useCallback(async () => {
    const token = await getToken();
    const response = await fetch('/api/gallery?manage=1', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not load gallery photos.');
    setImages(payload.images || []);
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setError('Firebase authentication is not available.');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        setLoading(false);
        setError('Please sign in as an administrator to manage gallery photos.');
        return;
      }
      void loadImages()
        .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load gallery photos.'))
        .finally(() => setLoading(false));
    });
    return () => unsubscribe();
  }, [loadImages]);

  const chooseFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    setNotice('');
    const chosen = Array.from(files).slice(0, 20);
    const valid: PendingImage[] = [];
    for (const file of chosen) {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setError(`${file.name}: use a JPG, PNG, or WebP image.`);
        continue;
      }
      if (file.size < 1 || file.size > MAX_IMAGE_SIZE) {
        setError(`${file.name}: each image must be smaller than 4 MB.`);
        continue;
      }
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Festival photo';
      valid.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        title: title.slice(0, 100),
        caption: '',
        altText: title.slice(0, 300),
      });
    }
    setPending(current => {
      const merged = [...current, ...valid].slice(0, 20);
      valid.slice(Math.max(0, 20 - current.length)).forEach(item => URL.revokeObjectURL(item.previewUrl));
      return merged;
    });
  };

  const patchPending = (id: string, updates: Partial<Pick<PendingImage, 'title' | 'caption' | 'altText'>>) => {
    setPending(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removePending = (id: string) => {
    setPending(current => {
      const item = current.find(entry => entry.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter(entry => entry.id !== id);
    });
  };

  const uploadPhotos = async () => {
    if (!pending.length || uploading) return;
    setUploading(true);
    setError('');
    setNotice('');
    let uploaded = 0;
    const failed: PendingImage[] = [];
    try {
      const token = await getToken();
      const queue = [...pending];
      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        setUploadProgress(`Uploading ${index + 1} of ${queue.length}: ${item.title}`);
        const form = new FormData();
        form.append('image', item.file);
        form.append('albumId', uploadAlbum);
        form.append('title', item.title);
        form.append('caption', item.caption);
        form.append('altText', item.altText || item.title);
        try {
          const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Upload failed.');
          uploaded += 1;
          URL.revokeObjectURL(item.previewUrl);
        } catch (reason) {
          failed.push(item);
          setError(`${item.title}: ${reason instanceof Error ? reason.message : 'Upload failed.'}`);
        }
      }
      setPending(failed);
      await loadImages();
      if (uploaded) setNotice(`${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded as drafts. Publish them when they are ready.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Photo upload could not be completed.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const updateImage = async (image: GalleryImage) => {
    setSavingId(image.id);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      const response = await fetch('/api/gallery', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: image.id,
          albumId: image.albumId,
          title: image.title,
          caption: image.caption,
          altText: image.altText,
          status: image.status,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save the photo.');
      setImages(current => current.map(item => item.id === image.id ? payload.image : item));
      setNotice('Photo details saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the photo.');
    } finally {
      setSavingId('');
    }
  };

  const deleteImage = async (image: GalleryImage) => {
    if (!window.confirm(`Delete "${image.title}" permanently? This also removes the image file from storage.`)) return;
    setDeletingId(image.id);
    setError('');
    setNotice('');
    try {
      const token = await getToken();
      const response = await fetch(`/api/gallery?id=${encodeURIComponent(image.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not delete the photo.');
      setImages(current => current.filter(item => item.id !== image.id));
      setNotice('Photo deleted.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the photo.');
    } finally {
      setDeletingId('');
    }
  };

  const visibleImages = images.filter(image =>
    (filterAlbum === 'ALL' || image.albumId === filterAlbum) &&
    (filterStatus === 'ALL' || image.status === filterStatus)
  );

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/media" className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" /> Back to Media Studio
            </Link>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
              <ImagePlus className="h-4 w-4" /> Festival Media
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Photo Gallery Manager</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Upload festival photos, organise them into albums, and control which images appear on the public gallery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); void loadImages().catch(reason => setError(reason instanceof Error ? reason.message : 'Refresh failed.')).finally(() => setLoading(false)); }}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh photos
          </button>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Upload new photos</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Select up to 20 JPG, PNG or WebP images. Each image must be smaller than 4 MB.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">Draft by default</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
              <UploadCloud className="h-7 w-7 text-blue-600" />
              <span className="mt-2 text-sm font-semibold text-slate-800">Choose photos</span>
              <span className="mt-1 text-xs text-slate-500">You can select multiple images at once</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={event => { chooseFiles(event.currentTarget.files); event.currentTarget.value = ''; }}
              />
            </label>
            <label className="block space-y-2 text-xs font-semibold text-slate-600">
              Upload album
              <select
                value={uploadAlbum}
                onChange={event => setUploadAlbum(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {GALLERY_ALBUMS.map(album => <option key={album.id} value={album.id}>{album.name}</option>)}
              </select>
              <span className="block text-[11px] font-normal leading-5 text-slate-400">All selected photos will be placed in this album. You can change an album later.</span>
            </label>
          </div>

          {pending.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-800">{pending.length} photo{pending.length === 1 ? '' : 's'} ready to upload</p>
                <button type="button" onClick={() => { pending.forEach(item => URL.revokeObjectURL(item.previewUrl)); setPending([]); }} disabled={uploading} className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">Clear selection</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pending.map(item => (
                  <article key={item.id} className="flex min-w-0 gap-3 rounded-xl border border-slate-200 p-3">
                    <img src={item.previewUrl} alt="" className="h-24 w-24 shrink-0 rounded-lg bg-slate-100 object-cover" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <input value={item.title} onChange={event => patchPending(item.id, { title: event.target.value })} aria-label="Photo title" maxLength={100} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" />
                      <input value={item.caption} onChange={event => patchPending(item.id, { caption: event.target.value })} aria-label="Photo caption" maxLength={300} placeholder="Caption (optional)" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-blue-500" />
                      <button type="button" onClick={() => removePending(item.id)} disabled={uploading} className="text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50">Remove</button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">{uploadProgress || 'Uploads are processed one at a time. Photos remain private until published.'}</p>
                <button type="button" onClick={uploadPhotos} disabled={uploading || !pending.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {uploading ? 'Uploading…' : 'Upload photos as drafts'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Photo library <span className="ml-1 text-xs font-medium text-slate-400">({images.length})</span></h2>
              <p className="mt-1 text-xs text-slate-500">Edit details, publish, archive or permanently delete an image.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <select value={filterAlbum} onChange={event => setFilterAlbum(event.target.value)} aria-label="Filter by album" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                <option value="ALL">All albums</option>
                {GALLERY_ALBUMS.map(album => <option key={album.id} value={album.id}>{album.name}</option>)}
              </select>
              <select value={filterStatus} onChange={event => setFilterStatus(event.target.value)} aria-label="Filter by status" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading photos…</div>
          ) : visibleImages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <ImagePlus className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No photos match this filter</p>
              <p className="mt-1 text-xs text-slate-500">Upload festival photos above to start building the gallery.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleImages.map(image => (
                <article key={image.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[16/10] bg-slate-100">
                    <img src={image.imageUrl} alt={image.altText || image.title} className="h-full w-full object-cover" loading="lazy" />
                    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${image.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : image.status === 'ARCHIVED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{image.status}</span>
                  </div>
                  <div className="space-y-3 p-4">
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-500">
                      Title
                      <input value={image.title} onChange={event => setImages(current => current.map(item => item.id === image.id ? { ...item, title: event.target.value } : item))} maxLength={100} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" />
                    </label>
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-500">
                      Caption
                      <textarea value={image.caption} onChange={event => setImages(current => current.map(item => item.id === image.id ? { ...item, caption: event.target.value } : item))} rows={2} maxLength={300} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500" />
                    </label>
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-500">
                      Album
                      <select value={image.albumId} onChange={event => setImages(current => current.map(item => item.id === image.id ? { ...item, albumId: event.target.value as GalleryImage['albumId'] } : item))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500">
                        {GALLERY_ALBUMS.map(album => <option key={album.id} value={album.id}>{album.name}</option>)}
                      </select>
                    </label>
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-500">
                      Visibility
                      <select value={image.status} onChange={event => setImages(current => current.map(item => item.id === image.id ? { ...item, status: event.target.value as GalleryStatus } : item))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500">
                        <option value="DRAFT">Draft — private</option>
                        <option value="PUBLISHED">Published — public</option>
                        <option value="ARCHIVED">Archived — hidden</option>
                      </select>
                    </label>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <button type="button" onClick={() => updateImage(image)} disabled={savingId === image.id || deletingId === image.id} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                        {savingId === image.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save changes
                      </button>
                      <button type="button" onClick={() => deleteImage(image)} disabled={deletingId === image.id || savingId === image.id} aria-label={`Delete ${image.title}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60">
                        {deletingId === image.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Publishing rule:</strong> Every new upload starts as a private draft. Choose Published and save to show the photo on the public /gallery page. Archived and Draft photos remain hidden.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
