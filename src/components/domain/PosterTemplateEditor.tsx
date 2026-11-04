'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Download, Globe, Grid2X2, ImagePlus, Layers, Plus, Save, Trash2, Type, Upload, CheckCircle2, ArrowUp, ArrowDown, RefreshCw, AlertCircle, ShieldAlert } from 'lucide-react';
import type { CompetitionResult, PosterConfig, PosterElement, PosterField, PosterTemplate, PosterWinnerContainer, PosterWinnerField, PosterWinnerLayer } from '@/types/fest';
import { auth } from '@/lib/firebase/client';
import { useFest } from '@/context/FestContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ResultPosterPreview } from './ResultPosterPreview';
import { PosterFontPicker } from './PosterFontPicker';
import { createPosterPreset, createTextElement, normalizePosterConfig, POSTER_FIELDS, POSTER_PRESETS, WINNER_POSITION_FORMATS, posterDimensions, validatePosterConfig } from '@/domain/poster';
import { exportPosterAsPng } from '@/utils/canvasExport';

const SAMPLE_RESULT: CompetitionResult = {
  id: 'sample-preview', competitionId: 'sample-preview', competitionCode: 'ART-01', competitionName: 'English Elocution', categoryName: 'Senior', type: 'SOLO', stageName: '', marksStatus: 'COMPLETE', resultStatus: 'DRAFT', posterReleased: false,
  ranks: ['Ayaan Ahmed', 'Muhammed Rihan', 'Omar Farooq'].map((name, index) => ({ rank: (index + 1) as 1 | 2 | 3, registrationId: `sample-${index}`, bib: `${101 + index}`, candidateName: name, teamId: `sample-${index}`, teamCode: ['BAY', 'NOO', 'AMA'][index], teamName: ['Al-Bayan', 'An-Noor', 'Al-Amal'][index], teamColor: '#2563EB', score: 95 - index * 3, grade: 'A', officialPoints: 10 - index * 2, totalEarnedPoints: 10 - index * 2 })),
};
const inputStyle = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-slate-600"><span>{label}</span>{children}</label>;
}
async function templateRequest(method = 'GET', body?: unknown): Promise<PosterTemplate[]> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in as an administrator to save templates.');
  const response = await fetch('/api/posters/templates', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Could not save the template.');
  return payload.templates;
}
async function readArtwork(file: File, background: boolean): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const scale = Math.min(1, (background ? 1600 : 500) / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Could not prepare this image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL(background ? 'image/jpeg' : 'image/webp', .8);
    if (data.length > 450000) throw new Error('This artwork is too detailed to save. Use a smaller image.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}

export function PosterTemplateEditor() {
  const { results, theme } = useFest();
  const [config, setConfig] = useState<PosterConfig>(() => createPosterPreset());
  const [resultId, setResultId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>('announcement');
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('My result poster');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  const [tab, setTab] = useState<'design' | 'layers' | 'saved'>('design');
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateSyncState, setTemplateSyncState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [templateSyncError, setTemplateSyncError] = useState('');
  const [lastTemplateSyncAt, setLastTemplateSyncAt] = useState<Date | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{ title: string; action: () => void } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PosterTemplate | null>(null);
  const refreshInFlight = useRef(false);
  const result = results.find(item => item.id === resultId);
  const preview = result ?? SAMPLE_RESULT;
  const published = results.filter(item => item.resultStatus === 'PUBLISHED');
  const selected = config.elements?.find(element => element.id === selectedId);
  const selectedWinnerLayer = config.winnerContainer?.layers.find(layer => `__winner-item:${layer.field}__` === selectedId);
  const selectedWinnerContainer = selectedId === '__winner-container__';
  const dimensions = posterDimensions(config.aspectRatio);
  const orderedCanvasLayers = [...(config.elements ?? [])].sort((a, b) => a.y - b.y);
  const layersBeforeWinner = orderedCanvasLayers.filter(element => !config.winnerContainer || element.y < config.winnerContainer.y);
  const layersAfterWinner = orderedCanvasLayers.filter(element => Boolean(config.winnerContainer) && element.y >= (config.winnerContainer?.y ?? 100));
  const renderCanvasLayer = (element: PosterElement) => <button type="button" key={element.id} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs ${selectedId === element.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setSelectedId(element.id)}>{element.type === 'image' ? <ImagePlus className="h-3.5 w-3.5 shrink-0" /> : <Type className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{element.label}</span></button>;
  const refreshTemplates = useCallback(async (showLoading = false) => {
    if (!auth?.currentUser) {
      const message = 'Sign in as an administrator to synchronize poster templates.';
      setTemplateSyncState('error');
      setTemplateSyncError(message);
      if (showLoading) setTemplatesLoading(false);
      throw new Error(message);
    }
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showLoading) setTemplatesLoading(true);
    setTemplateSyncState('loading');
    setTemplateSyncError('');
    try {
      const items = await templateRequest();
      setTemplates(items);
      setTemplateSyncState('ready');
      setTemplateSyncError('');
      setLastTemplateSyncAt(new Date());
      return items;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not synchronize poster templates.';
      setTemplateSyncState('error');
      setTemplateSyncError(message);
      throw reason;
    } finally {
      refreshInFlight.current = false;
      if (showLoading) setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setTemplatesLoading(false);
      setTemplateSyncState('error');
      setTemplateSyncError('Firebase authentication is not available.');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        setTemplates([]);
        setTemplatesLoading(false);
        setTemplateSyncState('error');
        setTemplateSyncError('Sign in as an administrator to load saved poster templates.');
        return;
      }
      void refreshTemplates(true).catch(() => undefined);
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && auth?.currentUser) {
        void refreshTemplates(false).catch(() => undefined);
      }
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 45000);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [refreshTemplates]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (next: PosterConfig) => { setConfig(next); setDirty(true); setNotice(''); setError(''); };
  const patchLayer = (id: string, updates: Partial<PosterElement>) => {
    setConfig(current => ({ ...current, elements: current.elements?.map(element => {
      if (element.id !== id) return element;
      const next = { ...element, ...updates };
      next.width = Math.max(1, Math.min(100, next.width)); next.height = Math.max(1, Math.min(100, next.height));
      next.x = Math.max(0, Math.min(100 - next.width, next.x)); next.y = Math.max(0, Math.min(100 - next.height, next.y));
      return next;
    }) }));
    setDirty(true); setNotice('');
  };
  const patchWinnerLayer = (field: PosterWinnerField, updates: Partial<PosterWinnerLayer>) => {
    setConfig(current => {
      if (!current.winnerContainer) return current;
      return { ...current, winnerContainer: {
        ...current.winnerContainer,
        layers: current.winnerContainer.layers.map(layer => {
          if (layer.field !== field) return layer;
          const next = { ...layer, ...updates };
          next.width = Math.max(1, Math.min(100, next.width));
          next.height = Math.max(1, Math.min(100, next.height));
          next.x = Math.max(0, Math.min(100 - next.width, next.x));
          next.y = Math.max(0, Math.min(100 - next.height, next.y));
          return next;
        }),
      } };
    });
    setDirty(true); setNotice('');
  };
  const patchWinnerContainer = (updates: Partial<PosterWinnerContainer>) => {
    setConfig(current => {
      if (!current.winnerContainer) return current;
      const next = { ...current.winnerContainer, ...updates };
      next.width = Math.max(1, Math.min(100, next.width));
      next.height = Math.max(1, Math.min(100, next.height));
      next.x = Math.max(0, Math.min(100 - next.width, next.x));
      next.y = Math.max(0, Math.min(100 - next.height, next.y));
      next.rowGap = Math.max(0, Math.min(10, next.rowGap));
      return { ...current, winnerContainer: next };
    });
    setDirty(true); setNotice('');
  };
  const handlePreviewMove = (id: string, position: { x: number; y: number }) => {
    if (id === '__winner-container__') patchWinnerContainer(position);
    else patchLayer(id, position);
  };
  const requestReplace = (title: string, action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    setPendingReplacement({ title, action });
  };
  const load = (next: PosterConfig) => { setConfig(normalizePosterConfig(next)); setSelectedId(null); setDirty(false); setNotice(''); setError(''); };
  async function perform(label: string, action: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'); } finally { setBusy(''); }
  }
  const selectedTemplate = templates.find(template => template.id === templateId);
  const templateReleased = selectedTemplate?.released === true;
  const releasedSnapshot = selectedTemplate?.releasedConfig ?? selectedTemplate?.config;
  const templateHasUnpublishedChanges = templateReleased && Boolean(releasedSnapshot)
    && JSON.stringify(config) !== JSON.stringify(releasedSnapshot);

  function saveTemplate(asCopy = false, releasedOverride?: boolean) {
    void perform(
      releasedOverride === true ? 'release-template' : releasedOverride === false ? 'withdraw-template' : 'template',
      async () => {
        if (!templateName.trim()) throw new Error('Give your template a name before saving.');
        const id = !asCopy && templateId ? templateId : crypto.randomUUID();
        const existingTemplate = !asCopy && templateId
          ? templates.find(template => template.id === templateId)
          : undefined;
        const released = releasedOverride ?? existingTemplate?.released ?? false;
        const checked = validatePosterConfig(config);
        const updatedTemplates = await templateRequest('PUT', {
          template: { id, name: templateName.trim(), config: checked, released },
        });
        setTemplates(updatedTemplates);
        setTemplateSyncState('ready');
        setTemplateSyncError('');
        setLastTemplateSyncAt(new Date());
        setTemplateId(id);
        setDirty(false);
        setNotice(releasedOverride === true
          ? 'Template released. It is now available to download for every published competition.'
          : releasedOverride === false
            ? 'Template withdrawn from the public gallery. Your saved template remains in Media Studio.'
            : 'Template saved. Release it once to make this design available with every published result.');
      },
    );
  }
  function deleteSavedTemplate(template: PosterTemplate) {
    setDeleteTarget(template);
  }

  function confirmDeleteSavedTemplate() {
    if (!deleteTarget) return;
    const template = deleteTarget;
    void perform(`delete-template-${template.id}`, async () => {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error('Please sign in as an administrator to delete templates.');
      const response = await fetch(`/api/posters/templates?id=${encodeURIComponent(template.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not delete the template.');

      const updatedTemplates = Array.isArray(payload.templates) ? payload.templates as PosterTemplate[] : [];
      setTemplates(updatedTemplates);
      setTemplateSyncState('ready');
      setTemplateSyncError('');
      setLastTemplateSyncAt(new Date());
      if (templateId === template.id) {
        setTemplateId(null);
        setConfig(createPosterPreset());
        setTemplateName('My result poster');
        setSelectedId('announcement');
        setDirty(false);
        setTab('design');
      }
      setDeleteTarget(null);
      setNotice(template.released
        ? 'Template deleted and removed from the public poster gallery.'
        : 'Saved template deleted.');
    });
  }

  function addText() {
    if ((config.elements?.length ?? 0) >= 30) { setError('A template can have up to 30 layers.'); return; }
    const element = { ...createTextElement(crypto.randomUUID()), color: config.textColor ?? '#FFFFFF' };
    change({ ...config, elements: [...(config.elements ?? []), element] }); setSelectedId(element.id); setTab('layers');
  }
  function upload(file: File | undefined, background: boolean) {
    if (!file) return;
    void perform('image', async () => {
      const image = await readArtwork(file, background);
      if (background) change({ ...config, backgroundImage: image });
      else {
        if ((config.elements?.length ?? 0) >= 30) throw new Error('A template can have up to 30 layers.');
        const element: PosterElement = { ...createTextElement(crypto.randomUUID()), type: 'image', label: 'Logo / image', image, x: 40, y: 4, width: 20, height: 12 };
        change({ ...config, elements: [...(config.elements ?? []), element] }); setSelectedId(element.id); setTab('layers');
      }
    });
  }
  function reorder(direction: number) {
    const elements = [...(config.elements ?? [])]; const index = elements.findIndex(element => element.id === selectedId);
    if (index < 0 || index + direction < 0 || index + direction >= elements.length) return;
    [elements[index], elements[index + direction]] = [elements[index + direction], elements[index]];
    change({ ...config, elements });
  }


  return <div className="min-w-0 space-y-5">
    <div className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end sm:p-5">
      <div className="min-w-0 w-full lg:max-w-md">
        <Field label="Preview with published result">
          <select
            className={inputStyle}
            value={resultId}
            disabled={Boolean(busy)}
            onChange={event => {
              const item = published.find(entry => entry.id === event.target.value);
              setResultId(event.target.value);
              setNotice(item
                ? 'Previewing this reusable design with published competition data.'
                : 'Designing a reusable template with sample winner data.');
            }}
          >
            <option value="">Sample result — design a reusable template</option>
            {published.map(item => <option key={item.id} value={item.id}>{item.competitionCode} · {item.competitionName}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
        <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${templateReleased ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          {templateReleased ? (templateHasUnpublishedChanges ? 'Released · draft changes pending' : 'Released template') : templateId ? 'Saved draft template' : 'Unsaved template'}
        </span>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button variant="outline" size="sm" disabled={Boolean(busy)} leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void perform('download', async () => { await exportPosterAsPng(preview, theme, config, templateName); setNotice('PNG preview download started.'); })} className="w-full sm:w-auto">
            {busy === 'download' ? 'Preparing…' : 'Download Preview'}
          </Button>
          <Button size="sm" disabled={Boolean(busy) || templateSyncState !== 'ready'} leftIcon={<Globe className="h-3.5 w-3.5" />} onClick={() => saveTemplate(false, true)} isLoading={busy === 'release-template'} className="w-full sm:w-auto">
            {templateReleased ? 'Update Released Template' : 'Release Template'}
          </Button>
          {templateReleased && <Button variant="outline" size="sm" disabled={Boolean(busy) || templateSyncState !== 'ready'} onClick={() => saveTemplate(false, false)} isLoading={busy === 'withdraw-template'} className="w-full sm:w-auto">Withdraw</Button>}
        </div>
      </div>
    </div>

    <div className={`flex min-w-0 flex-col gap-2 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${templateSyncState === 'error' ? 'border-red-200 bg-red-50' : templateSyncState === 'loading' ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        {templateSyncState === 'error'
          ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          : templateSyncState === 'loading'
            ? <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />}
        <div className="min-w-0">
          <p className={`text-xs font-bold ${templateSyncState === 'error' ? 'text-red-800' : templateSyncState === 'loading' ? 'text-blue-800' : 'text-emerald-800'}`}>
            {templateSyncState === 'error' ? 'Template library sync unavailable' : templateSyncState === 'loading' ? 'Synchronizing template library' : 'Template library synced'}
          </p>
          <p className={`mt-0.5 text-[11px] leading-5 ${templateSyncState === 'error' ? 'text-red-700' : templateSyncState === 'loading' ? 'text-blue-700' : 'text-emerald-700'}`}>
            {templateSyncState === 'error'
              ? templateSyncError
              : templateSyncState === 'loading'
                ? 'Checking the latest saved templates from the secure server.'
                : `Shared template library is up to date${lastTemplateSyncAt ? ` · Updated ${lastTemplateSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}. Refreshes when this tab returns to focus and every 45 seconds.`}
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" disabled={templateSyncState === 'loading'} isLoading={templateSyncState === 'loading'} leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void refreshTemplates(true).catch(() => undefined)}>
        Refresh library
      </Button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
    <fieldset disabled={Boolean(busy)} className="grid min-w-0 grid-cols-1 gap-3 md:gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px] xl:items-start">
      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-5 grid grid-cols-3 rounded-lg bg-slate-100 p-1">{(['design', 'layers', 'saved'] as const).map(value => <button type="button" key={value} onClick={() => setTab(value)} className={`rounded-md px-1 py-2 text-xs font-semibold capitalize ${tab === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`} aria-pressed={tab === value}>{value}</button>)}</div>
          {tab === 'design' && <div className="space-y-5">
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Start with a design</p><div className="space-y-2">{POSTER_PRESETS.map(preset => <button type="button" key={preset.id} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-2.5 text-left hover:border-blue-400" onClick={() => requestReplace('Start a new poster design?', () => { load(createPosterPreset(preset.id)); setTemplateId(null); setTemplateName(`${preset.name} template`); })}><span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-md border border-black/10 text-lg" style={{ background: preset.color, color: preset.id === 'editorial' ? '#846E45' : '#EACB85' }}>✦</span><span><strong className="block text-xs text-slate-800">{preset.name}</strong><span className="text-[10px] text-slate-500">{preset.description}</span></span></button>)}</div></div>
            <Field label="Canvas size"><select className={inputStyle} value={config.aspectRatio} onChange={event => change({ ...config, aspectRatio: event.target.value as PosterConfig['aspectRatio'] })}><option value="1:1">Square · 1080 × 1080</option><option value="4:5">Portrait · 1080 × 1350</option><option value="9:16">Story · 1080 × 1920</option></select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Background"><input type="color" aria-label="Background colour" className="h-9 w-full cursor-pointer rounded border border-slate-200" value={config.backgroundColor} onChange={event => change({ ...config, backgroundColor: event.target.value })} /></Field><Field label="Decoration"><input type="color" aria-label="Decoration colour" className="h-9 w-full cursor-pointer rounded border border-slate-200" value={config.accentColor} onChange={event => change({ ...config, accentColor: event.target.value })} /></Field></div>
            <Field label="Decorative style"><select className={inputStyle} value={config.decoration} onChange={event => change({ ...config, decoration: event.target.value as PosterConfig['decoration'] })}><option value="arches">Classic arches</option><option value="confetti">Confetti</option><option value="minimal">Minimal lines</option></select></Field>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-xs text-slate-600 hover:border-blue-400"><Upload className="h-5 w-5 text-blue-600" /><strong>Upload background</strong><span className="text-[10px]">PNG, JPG or WebP · up to 10 MB</span><input aria-label="Upload background artwork" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => { upload(event.target.files?.[0], true); event.target.value = ''; }} /></label>
            {config.backgroundImage && <div className="space-y-2"><Field label="Background image opacity"><input type="range" min="0" max="1" step="0.05" value={config.backgroundOpacity ?? 1} onChange={event => change({ ...config, backgroundOpacity: Number(event.target.value) })} className="w-full" /></Field><button type="button" onClick={() => change({ ...config, backgroundImage: undefined })} className="text-xs font-semibold text-red-600">Remove background image</button></div>}
          </div>}
          {tab === 'layers' && <div className="space-y-3">
            <p className="text-[10px] leading-relaxed text-slate-500">One Winner Container holds a reusable item layout. Position, name and team layers repeat for every ranked winner, including ties.</p>
            <div className="max-h-[560px] space-y-1 overflow-y-auto">
              {layersBeforeWinner.map(renderCanvasLayer)}
              {config.winnerContainer ? <div className="my-2 rounded-xl border border-slate-200 bg-white p-2">
                <button type="button" aria-label="Select Winner Container" className={`flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-xs ${selectedWinnerContainer ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`} onClick={() => setSelectedId('__winner-container__')}>
                  <Layers className="h-4 w-4 shrink-0" /><span className="font-semibold">Winner Container</span>
                </button>
                <div className="ml-2 mt-2 border-l-2 border-slate-200 pl-2">
                  <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">Winner Item (All)</p>
                  {config.winnerContainer.layers.map(layer => <button type="button" key={layer.field} aria-label={`Select winner ${layer.label} layer`} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${selectedId === `__winner-item:${layer.field}__` ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setSelectedId(`__winner-item:${layer.field}__`)}><Type className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{layer.label}</span><span className="ml-auto text-[9px] text-slate-400">ALL</span></button>)}
                </div>
              </div> : <button type="button" className="my-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-200 px-3 py-3 text-xs font-semibold text-blue-700 hover:bg-blue-50" onClick={() => {
                const winnerContainer = createPosterPreset().winnerContainer;
                if (winnerContainer) change({ ...config, winnerContainer });
              }}><Plus className="h-3.5 w-3.5" /> Add Winner Container</button>}
              {layersAfterWinner.map(renderCanvasLayer)}
            </div>
          </div>}
          {tab === 'saved' && <div className="space-y-2">
            {templatesLoading ? <p className="text-xs text-slate-500">Loading your templates…</p> : templates.length ? templates.map(template => (
              <div key={template.id} className={`flex items-stretch gap-2 rounded-xl border p-2 ${templateId === template.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <button type="button" disabled={Boolean(busy)} className="min-w-0 flex-1 rounded-lg p-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60" onClick={() => requestReplace(`Load “${template.name}”?`, () => {
                  load(template.config);
                  setTemplateId(template.id);
                  setTemplateName(template.name);
                })}>
                  <strong className="block break-words text-slate-900">{template.name}</strong>
                  <span className="mt-1 block text-[10px] text-slate-500">{template.config.aspectRatio} · {template.config.elements?.length ?? 0} layers</span>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${template.released ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{template.released ? 'Publicly released' : 'Private draft'}</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy) || templateSyncState !== 'ready'}
                  aria-label={`Delete template ${template.name}`}
                  title={template.released ? 'Delete template and remove it from the public gallery' : 'Delete saved template'}
                  onClick={() => deleteSavedTemplate(template)}
                  className="flex w-9 shrink-0 items-center justify-center self-center rounded-lg border border-red-100 bg-white text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === `delete-template-${template.id}`
                    ? <span className="text-xs font-bold">…</span>
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            )) : <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Your saved templates appear here. Released templates are available to the public for every published result; private drafts remain in Media Studio until released.</p>}
          </div>}
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><Field label="Template name"><input className={inputStyle} value={templateName} maxLength={80} onChange={event => setTemplateName(event.target.value)} /></Field><Button className="w-full" size="sm" variant="secondary" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={() => saveTemplate()} disabled={templateSyncState !== 'ready'}>{templateId ? 'Update template' : 'Save template'}</Button>{templateId && <button type="button" className="w-full text-xs font-medium text-blue-600" onClick={() => saveTemplate(true)} disabled={templateSyncState !== 'ready'}>Save as a new template</button>}<p className="text-[10px] leading-relaxed text-slate-400">Saving stores your reusable design as a draft. Release the template once to make it available for every published competition. Draft edits do not change the live version until you choose Update Released Template.</p></div>
      </div>
      <div className="order-first min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-[#e9edf2] xl:order-none">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-xs font-semibold text-slate-700">Live canvas</span><span className="text-[10px] text-slate-400">{dirty ? 'Unsaved changes' : 'Ready'}</span></div><button type="button" aria-label="Toggle canvas grid" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)} className={`rounded-md p-1.5 ${showGrid ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}><Grid2X2 className="h-4 w-4" /></button></div>
        <div className="flex min-h-[440px] flex-col items-center justify-center p-3 sm:min-h-[570px] sm:p-8" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
          <div className="w-full" style={{ maxWidth: config.aspectRatio === '9:16' ? 330 : 460 }}><ResultPosterPreview result={preview} theme={theme} config={config} selectedId={selectedId} onSelect={setSelectedId} onMove={handlePreviewMove} showGrid={showGrid} className="w-full shadow-xl" /></div>
          <div className="mt-5 text-center text-[10px] font-medium text-slate-500">{dimensions.width} × {dimensions.height} px · PNG export{!result && <span className="mt-1 block rounded-full bg-white/70 px-3 py-1 text-amber-700">Sample names for design preview only</span>}</div>
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-800"><Layers className="h-4 w-4 text-blue-600" />Layer properties</h2>
          <div className="mb-4 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={addText} leftIcon={<Plus className="h-3.5 w-3.5" />}>Text</Button><label className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><ImagePlus className="h-3.5 w-3.5" />Image<input aria-label="Upload logo or image layer" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { upload(event.target.files?.[0], false); event.target.value = ''; }} /></label></div>
          {selected ? <div className="space-y-4">
            <Field label="Layer name"><input className={inputStyle} value={selected.label} maxLength={80} onChange={event => patchLayer(selected.id, { label: event.target.value })} /></Field>
            {selected.type === 'text' && <><Field label="Content source"><select className={inputStyle} value={selected.field} onChange={event => patchLayer(selected.id, { field: event.target.value as PosterField })}>{POSTER_FIELDS.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}</select></Field>{selected.field === 'text' ? <Field label="Text"><textarea className={`${inputStyle} min-h-20`} value={selected.text} maxLength={500} onChange={event => patchLayer(selected.id, { text: event.target.value })} /></Field> : <p className="rounded-lg bg-blue-50 p-2 text-[10px] leading-relaxed text-blue-700">This field fills automatically from the selected result.</p>}
            <PosterFontPicker value={selected.fontFamily} onChange={fontFamily => patchLayer(selected.id, { fontFamily })} />
            <div className="grid grid-cols-2 gap-2"><Field label="Font size"><input className={inputStyle} type="number" min="8" max="180" value={selected.fontSize} onChange={event => patchLayer(selected.id, { fontSize: Math.max(8, Math.min(180, Number(event.target.value))) })} /></Field><Field label="Weight"><select className={inputStyle} value={selected.fontWeight} onChange={event => patchLayer(selected.id, { fontWeight: event.target.value as PosterElement['fontWeight'] })}><option value="400">Regular</option><option value="600">Semibold</option><option value="800">Bold</option></select></Field></div>
            <div className="grid grid-cols-2 gap-2"><Field label="Text colour"><input aria-label="Layer text colour" type="color" className="h-9 w-full rounded border border-slate-200" value={selected.color} onChange={event => patchLayer(selected.id, { color: event.target.value })} /></Field><Field label="Alignment"><select className={inputStyle} value={selected.align} onChange={event => patchLayer(selected.id, { align: event.target.value as PosterElement['align'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field></div></>}
            <div className="grid grid-cols-2 gap-2">{(['x', 'y', 'width', 'height'] as const).map(key => <Field key={key} label={`${key === 'x' ? 'Left' : key === 'y' ? 'Top' : key === 'width' ? 'Width' : 'Height'} (%)`}><input className={inputStyle} type="number" min={key === 'x' || key === 'y' ? 0 : 1} max="100" step="0.5" value={Number(selected[key].toFixed(1))} onChange={event => patchLayer(selected.id, { [key]: Number(event.target.value) })} /></Field>)}</div>
            <p className="text-[10px] leading-relaxed text-slate-400">This standard layer is placed directly on the poster canvas.</p>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3"><div className="flex gap-1"><button type="button" aria-label="Move layer backward" onClick={() => reorder(-1)} className="rounded p-2 text-slate-500 hover:bg-slate-100"><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" aria-label="Move layer forward" onClick={() => reorder(1)} className="rounded p-2 text-slate-500 hover:bg-slate-100"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" aria-label="Duplicate selected layer" className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => { if ((config.elements?.length ?? 0) >= 30) { setError('Maximum 30 layers.'); return; } const copy = { ...selected, id: crypto.randomUUID(), label: `${selected.label.slice(0, 70)} copy` }; change({ ...config, elements: [...(config.elements ?? []), copy] }); setSelectedId(copy.id); }}><Copy className="h-3.5 w-3.5" /></button></div><button type="button" aria-label="Delete selected layer" className="rounded p-2 text-red-500 hover:bg-red-50" onClick={() => { change({ ...config, elements: config.elements?.filter(element => element.id !== selected.id) }); setSelectedId(null); }}><Trash2 className="h-4 w-4" /></button></div>
          </div> : selectedWinnerLayer ? <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-900">{selectedWinnerLayer.label} · All Winners</p>
              <p className="mt-1 text-[10px] leading-relaxed text-blue-700">This is one reusable child layer. Change its position or style once and it updates across every winner row.</p>
            </div>
            <Field label="Layer name"><input className={inputStyle} value={selectedWinnerLayer.label} maxLength={80} onChange={event => patchWinnerLayer(selectedWinnerLayer.field, { label: event.target.value })} /></Field>
            <Field label="Winner data"><input className={inputStyle} value={selectedWinnerLayer.field === 'position' ? 'Placement label' : selectedWinnerLayer.field === 'name' ? 'Published winner name' : 'Winner team'} disabled readOnly /></Field>
            {selectedWinnerLayer.field === 'position' ? <Field label="Position format"><select className={inputStyle} value={config.winnerPositionFormat ?? 'padded-place'} onChange={event => change({ ...config, winnerPositionFormat: event.target.value as NonNullable<PosterConfig['winnerPositionFormat']> })}>{WINNER_POSITION_FORMATS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field> : <p className="rounded-lg bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-500">This value is filled automatically from the published result and cannot be manually overridden.</p>}
            {selectedWinnerLayer.type === 'text' && <>
              <PosterFontPicker value={selectedWinnerLayer.fontFamily} onChange={fontFamily => patchWinnerLayer(selectedWinnerLayer.field, { fontFamily })} />
              <div className="grid grid-cols-2 gap-2"><Field label="Font size"><input className={inputStyle} type="number" min="8" max="180" value={selectedWinnerLayer.fontSize} onChange={event => patchWinnerLayer(selectedWinnerLayer.field, { fontSize: Math.max(8, Math.min(180, Number(event.target.value))) })} /></Field><Field label="Weight"><select className={inputStyle} value={selectedWinnerLayer.fontWeight} onChange={event => patchWinnerLayer(selectedWinnerLayer.field, { fontWeight: event.target.value as PosterWinnerLayer['fontWeight'] })}><option value="400">Regular</option><option value="600">Semibold</option><option value="800">Bold</option></select></Field></div>
              <div className="grid grid-cols-2 gap-2"><Field label="Text colour"><input aria-label="Winner text colour" type="color" className="h-9 w-full rounded border border-slate-200" value={selectedWinnerLayer.color} onChange={event => patchWinnerLayer(selectedWinnerLayer.field, { color: event.target.value })} /></Field><Field label="Alignment"><select className={inputStyle} value={selectedWinnerLayer.align} onChange={event => patchWinnerLayer(selectedWinnerLayer.field, { align: event.target.value as PosterWinnerLayer['align'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field></div>
            </>}
            <p className="text-[10px] font-semibold text-slate-500">Position and size within one winner row</p>
            <div className="grid grid-cols-2 gap-2">{(['x', 'y', 'width', 'height'] as const).map(key => <Field key={key} label={`${key === 'x' ? 'Left' : key === 'y' ? 'Top' : key === 'width' ? 'Width' : 'Height'} (%)`}><input className={inputStyle} type="number" min={key === 'x' || key === 'y' ? 0 : 1} max="100" step="0.5" value={Number(selectedWinnerLayer[key].toFixed(1))} onChange={event => patchWinnerLayer(selectedWinnerLayer.field, { [key]: Number(event.target.value) })} /></Field>)}</div>
            <button type="button" aria-label="Center winner item layer" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => patchWinnerLayer(selectedWinnerLayer.field, { x: Math.max(0, (100 - selectedWinnerLayer.width) / 2) })}>Center this layer</button>
          </div> : selectedWinnerContainer && config.winnerContainer ? <div className="space-y-4">
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
              <p className="text-xs font-bold text-teal-900">Winner Container</p>
              <p className="mt-1 text-[10px] leading-relaxed text-teal-700">One container repeats the item layout for all published ranked winners. Tied winners receive their own row automatically.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">{(['x', 'y', 'width', 'height'] as const).map(key => <Field key={key} label={`${key === 'x' ? 'Left' : key === 'y' ? 'Top' : key === 'width' ? 'Width' : 'Height'} on canvas (%)`}><input className={inputStyle} type="number" min={key === 'x' || key === 'y' ? 0 : 1} max="100" step="0.5" value={Number(config.winnerContainer![key].toFixed(1))} onChange={event => patchWinnerContainer({ [key]: Number(event.target.value) })} /></Field>)}</div>
            <Field label="Space between winner rows"><input className="w-full accent-blue-600" type="range" min="0" max="8" step="0.5" value={config.winnerContainer.rowGap} onChange={event => patchWinnerContainer({ rowGap: Number(event.target.value) })} /><span className="block text-[10px] text-slate-500">{config.winnerContainer.rowGap.toFixed(1)}% canvas spacing</span></Field>
            <div className="grid grid-cols-2 gap-2"><button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => patchWinnerContainer({ x: (100 - config.winnerContainer!.width) / 2 })}>Center horizontally</button><button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => patchWinnerContainer({ y: 41, height: 45, rowGap: 1 })}>Reset spacing</button></div>
          </div> : <p className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">Select a normal layer, Winner Container, or one of the reusable winner item layers to edit its properties.</p>}

        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-2 text-xs font-bold text-slate-700">Release one reusable template</h3><ol className="space-y-2 text-[11px] leading-relaxed text-slate-500"><li>1. Design and save your poster template.</li><li>2. Select <strong>Release Template</strong> to publish this design once.</li><li>3. The same released template becomes available for every published competition. Visitors choose a result, pick any released template, then download the PNG.</li></ol><p className="mt-3 text-[10px] leading-relaxed text-slate-400">Releasing a template is separate from publishing competition results and does not alter scores, grades, or points.</p></div>
      </div>
    </fieldset>
    <Modal
      isOpen={Boolean(pendingReplacement)}
      onClose={() => setPendingReplacement(null)}
      title={pendingReplacement?.title || 'Replace unsaved design?'}
      description="Your current canvas has unsaved changes. Save the current template first, or discard those edits to continue."
      maxWidth="sm"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="md" onClick={() => setPendingReplacement(null)} className="w-full sm:w-auto">Keep editing</Button>
          <Button type="button" variant="destructive" size="md" onClick={() => {
            const action = pendingReplacement?.action;
            setPendingReplacement(null);
            action?.();
          }} className="w-full sm:w-auto">Discard changes</Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><ShieldAlert className="h-5 w-5" /></span>
        <p className="text-sm leading-6 text-slate-600">Loading another preset or saved template will replace the current canvas. Any unsaved edits will be lost.</p>
      </div>
    </Modal>

    <Modal
      isOpen={Boolean(deleteTarget)}
      onClose={() => { if (!busy.startsWith('delete-template-')) setDeleteTarget(null); }}
      title="Delete saved template?"
      description="This removes the template from your private library and, if released, from the public poster gallery."
      maxWidth="sm"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="md" onClick={() => setDeleteTarget(null)} disabled={busy.startsWith('delete-template-')} className="w-full sm:w-auto">Cancel</Button>
          <Button type="button" variant="destructive" size="md" onClick={confirmDeleteSavedTemplate} isLoading={busy === `delete-template-${deleteTarget?.id}`} disabled={templateSyncState !== 'ready'} className="w-full sm:w-auto">Delete template</Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-red-50 p-2.5 text-red-600"><Trash2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-900">{deleteTarget?.name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {deleteTarget?.released
              ? 'This template is publicly released. Deleting it also removes it from the gallery for all published competitions.'
              : 'This private draft will be permanently removed from the shared template library.'}
          </p>
          {templateId === deleteTarget?.id && dirty && <p className="mt-2 text-xs font-semibold text-red-700">Your unsaved edits to this template will also be lost.</p>}
          <p className="mt-2 text-xs text-slate-400">This action cannot be undone.</p>
        </div>
      </div>
    </Modal>
  </div>;
}

