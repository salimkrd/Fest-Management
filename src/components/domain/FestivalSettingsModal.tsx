'use client';

import React, { useEffect, useState } from 'react';
import { useFest } from '@/context/FestContext';
import { auth, storage } from '@/lib/firebase/client';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { normalizeFestivalSettings } from '@/domain/festivalSettings';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FestivalFontPicker } from '@/components/domain/FestivalFontPicker';
import { DEFAULT_FESTIVAL_NAME_FONT } from '@/domain/festivalFonts';

interface Props { isOpen: boolean; onClose: () => void }
export function FestivalSettingsModal({ isOpen, onClose }: Props) {
  const { theme, themeSyncState, updateTheme } = useFest();
  const [form, setForm] = useState({
    festivalName: theme.festivalName, festivalNameFont: theme.festivalNameFont || DEFAULT_FESTIVAL_NAME_FONT,
    institutionName: theme.institutionName, logoUrl: theme.logoUrl || '', festivalStartDate: theme.festivalStartDate || '',
    festivalEndDate: theme.festivalEndDate || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  useEffect(() => {
    if (!logoFile) { setLocalPreviewUrl(''); return; }
    const objectUrl = URL.createObjectURL(logoFile);
    setLocalPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);
  useEffect(() => setLogoPreviewFailed(false), [form.logoUrl]);
  useEffect(() => {
    if (!isOpen || themeSyncState === 'loading') return;
    setForm({
      festivalName: theme.festivalName, festivalNameFont: theme.festivalNameFont || DEFAULT_FESTIVAL_NAME_FONT,
      institutionName: theme.institutionName, logoUrl: theme.logoUrl || '', festivalStartDate: theme.festivalStartDate || '',
      festivalEndDate: theme.festivalEndDate || ''
    });
    setLogoFile(null);
    setError(themeSyncState === 'error' ? 'Live festival settings could not be loaded. Refresh before editing.' : '');
    setSaved(false);
  }, [isOpen, themeSyncState]); // Initialize only after the authoritative settings snapshot has loaded

  const change = (key: keyof typeof form, value: string) => {
    setForm(old => ({ ...old, [key]: value }));
    setError(''); setSaved(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    try {
      const changes = normalizeFestivalSettings(logoFile ? { ...form, logoUrl: '' } : form);
      setSaving(true); setError(''); setSaved(false);
      if (logoFile) {
        if (!auth?.currentUser) throw new Error('Sign in as Chief Administrator to upload the logo.');
        if (!storage) throw new Error('Firebase Storage is not configured for this environment.');
        const extensionByType: Record<string, string> = {
          'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
        };
        const extension = extensionByType[logoFile.type];
        if (!extension || logoFile.size === 0 || logoFile.size >= 5 * 1024 * 1024) {
          throw new Error('Upload a nonempty PNG, JPG or WebP image smaller than 5 MB.');
        }
        const signature = new Uint8Array(await logoFile.slice(0, 12).arrayBuffer());
        const isPng = signature.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => signature[i] === v);
        const isJpeg = signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
        const isWebp = signature.length >= 12 && String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' && String.fromCharCode(...signature.slice(8, 12)) === 'WEBP';
        if (!(logoFile.type === 'image/png' && isPng || logoFile.type === 'image/jpeg' && isJpeg || logoFile.type === 'image/webp' && isWebp)) {
          throw new Error('Selected file content does not match its image type.');
        }
        // Storage Rules enforce the signed-in ADMIN role; WIF remains Firestore-only.
        const logoRef = ref(storage, 'branding/festival-logo-' + crypto.randomUUID() + '.' + extension);
        const uploaded = await uploadBytes(logoRef, logoFile, {
          contentType: logoFile.type,
          customMetadata: { uploadedBy: auth.currentUser.uid },
        });
        changes.logoUrl = await getDownloadURL(uploaded.ref);
      }
      // A share-page URL is not an image. Validate the actual browser-renderable
      // image before publishing so every portal won't fall back to an initial.
      if (changes.logoUrl && !logoFile) {
        await new Promise<void>((resolve, reject) => {
          const probe = new Image();
          const timeout = window.setTimeout(() => reject(new Error('Logo URL took too long to load. Use a direct public PNG/JPG/WebP image URL.')), 8000);
          probe.onload = () => { window.clearTimeout(timeout); resolve(); };
          probe.onerror = () => { window.clearTimeout(timeout); reject(new Error('Logo URL does not load as an image. Use a direct public image URL, not a sharing or conversation page.')); };
          probe.src = changes.logoUrl;
        });
      }
      await updateTheme(changes);
      setForm(current => ({ ...current, logoUrl: changes.logoUrl }));
      setLogoFile(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save festival settings.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal isOpen={isOpen} onClose={() => { if (!saving) onClose(); }}
    title="Festival Settings"
    description="Chief Administrator · Official festival identity and dates across every portal"
    maxWidth="xl"
    footer={<div className="w-full flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Close</Button>
      <Button variant="primary" size="sm" type="submit" form="festival-settings-form"
        isLoading={saving} disabled={saving || themeSyncState !== 'ready'}>Save Settings</Button>
    </div>}>
    <form id="festival-settings-form" onSubmit={submit} className="space-y-5">
      {themeSyncState === 'loading' && <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Loading the latest published festival settings…</p>}
      {themeSyncState === 'error' && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">Could not load the latest festival settings. Refresh the page before making changes.</p>}
      <p className="text-xs text-[#526070] rounded-lg bg-blue-50 border border-blue-100 p-3">
        Changes are published across Admin, Team Manager, Judge, Green Room, Participant and Public portals.
        Festival dates follow Asia/Kolkata (Indian Standard Time).
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-xs font-semibold">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-xs font-semibold">Festival settings saved successfully.</p>}
      <Input label="Festival Name" value={form.festivalName} required maxLength={100}
        onChange={e => change('festivalName', e.target.value)} placeholder="INSPIRAATH 26" />
      <FestivalFontPicker value={form.festivalNameFont} previewName={form.festivalName}
        onChange={value => change('festivalNameFont', value)} />
      <Input label="Institution Name" value={form.institutionName} required maxLength={150}
        onChange={e => change('institutionName', e.target.value)} placeholder="Ma'din Suffa Campus Vavoor" />
      <div>
        <div className="mb-3">
          <label htmlFor="festival-logo-file" className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Upload Festival Logo (Recommended)</label>
          <input id="festival-logo-file" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm border border-[#E1E7EF] rounded-lg p-2 bg-white" onChange={event => {
            const file = event.target.files?.[0] || null;
            if (file && (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size >= 5 * 1024 * 1024)) {
              setError('Upload a PNG, JPG or WebP image smaller than 5 MB.'); setLogoFile(null); return;
            }
            setLogoFile(file); setLogoPreviewFailed(false); setError(''); setSaved(false);
          }} />
          <p className="mt-1 text-xs text-[#526070]">Upload directly to Firebase Storage, like participant photos. Upload takes priority over the URL below when you save.</p>
        </div>
        <Input label="Festival Logo URL (Optional)" type="url" value={form.logoUrl}
          placeholder="https://example.com/festival-logo.png"
          helperText="Use a direct, publicly accessible image URL (not a ChatGPT chat link). Leave empty for an initial."
          onChange={e => change('logoUrl', e.target.value)} />
        <div className="mt-3 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] p-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#526070] mb-2">
            Logo Preview {logoFile ? '· Uploaded when you save' : form.logoUrl.trim() ? '· Save to publish' : '· No logo URL'}
          </p>
          <div className="flex items-center gap-3">
            {localPreviewUrl ? (
              <img src={localPreviewUrl} alt="Selected festival logo" className="w-14 h-14 bg-white rounded-lg object-contain border border-[#E1E7EF]" />
            ) : form.logoUrl.trim() && !logoPreviewFailed ? (
              <img key={form.logoUrl.trim()} src={form.logoUrl.trim()} alt="New festival logo preview"
                onError={() => setLogoPreviewFailed(true)}
                className="w-14 h-14 bg-white rounded-lg object-contain border border-[#E1E7EF]" />
            ) : (
              <div role="img" aria-label="Festival logo initial fallback"
                className="w-14 h-14 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold text-2xl">
                {form.festivalName.trim().charAt(0).toUpperCase() || 'F'}
              </div>
            )}
            <span className="text-xs text-[#526070]">
              {logoFile ? 'Selected upload · Save Settings to publish' : form.logoUrl.trim() ? 'Preview of the entered Logo URL' : 'No logo uploaded — festival initial'}
            </span>
          </div>
          {logoPreviewFailed && form.logoUrl.trim() && !logoFile && (
            <p role="alert" className="mt-2 text-xs text-red-700 font-semibold">
              This URL could not display an image. Use a direct, publicly accessible image link (PNG, JPG or WebP).
            </p>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-[#111111] mb-2">Festival Date Range</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="From (Start Date)" type="date" required value={form.festivalStartDate}
            onChange={e => change('festivalStartDate', e.target.value)} />
          <Input label="To (End Date)" type="date" required min={form.festivalStartDate || undefined}
            value={form.festivalEndDate} onChange={e => change('festivalEndDate', e.target.value)} />
        </div>
        <p className="mt-2 text-[11px] text-[#526070]">Example: 16/10/2026 to 18/10/2026 · LIVE Day 1/3, Day 2/3, Day 3/3 on those respective dates.</p>
      </div>
    </form>
  </Modal>;
}
