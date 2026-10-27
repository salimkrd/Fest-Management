import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPosterPreset } from '@/domain/poster';

const harness = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  const writes: string[] = [];
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1)!,
    exists: documents.has(path),
    data: () => documents.get(path),
  });
  const document = (path: string) => ({
    path,
    get: async () => snapshot(path),
    set: async (value: Record<string, unknown>) => { documents.set(path, structuredClone(value)); writes.push(path); },
    delete: async () => { documents.delete(path); writes.push(path); },
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (path: string, filter?: { field: string; value: unknown }) => ({
    doc: (id: string) => document(`${path}/${id}`),
    where: (field: string, _operator: string, value: unknown) => collection(path, { field, value }),
    get: async () => ({ docs: [...documents.keys()].filter(key =>
      key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1 &&
      (!filter || documents.get(key)?.[filter.field] === filter.value),
    ).map(snapshot) }),
  });
  const db = {
    collection,
    runTransaction: async <T>(callback: (transaction: {
      get: (ref: ReturnType<typeof document>) => Promise<ReturnType<typeof snapshot>>;
      set: (ref: ReturnType<typeof document>, data: Record<string, unknown>) => void;
    }) => Promise<T>) => {
      const pending: Array<() => Promise<void>> = [];
      const result = await callback({
        get: async ref => snapshot(ref.path),
        set: (ref, data) => { pending.push(() => ref.set(data)); },
      });
      for (const write of pending) await write();
      return result;
    },
  };
  return { documents, writes, db, available: true, assertAdmin: vi.fn() };
});

vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => harness.available ? harness.db : null }));
vi.mock('@/services/authService', () => ({ AuthService: { assertAdmin: harness.assertAdmin } }));

import { PosterService } from '@/services/posterService';

describe('Poster persistence and publication boundaries', () => {
  const released = createPosterPreset('laureate');
  const draft = createPosterPreset('editorial');
  const officialResult = {
    resultStatus: 'PUBLISHED', competitionId: 'event-1', posterReleased: false,
    ranks: [{ candidateName: 'Winner', rank: 1, officialPoints: 11, score: 95 }],
  };

  beforeEach(() => {
    harness.available = true;
    harness.documents.clear();
    harness.writes.length = 0;
    harness.assertAdmin.mockReset().mockImplementation(async (token: string) => {
      if (token !== 'admin-token') throw new Error('Unauthorized: Operation requires ADMIN role.');
      return { uid: 'verified-admin', role: 'ADMIN' };
    });
    harness.documents.set('results/result-1', structuredClone(officialResult));
    harness.documents.set('pointsLedger/result-1_winner', { points: 11, status: 'COMMITTED' });
  });

  it('requires verified admin authorization for all drafts and template operations', async () => {
    await expect(PosterService.saveResult('manager-token', 'result-1', { config: draft })).rejects.toThrow('ADMIN');
    await expect(PosterService.listAdmin('')).rejects.toThrow('ADMIN');
    await expect(PosterService.listTemplates('')).rejects.toThrow('ADMIN');
    await expect(PosterService.saveTemplate('manager-token', { id: 'template-1', name: 'Mine', config: draft })).rejects.toThrow('ADMIN');
    await expect(PosterService.deleteTemplate('manager-token', 'template-1')).rejects.toThrow('ADMIN');
    expect(harness.writes).toEqual([]);
  });

  it('saves a private draft without making it publicly readable', async () => {
    const saved = await PosterService.saveResult('admin-token', 'result-1', { config: draft });
    expect(saved.posterDraftConfig?.colorPreset).toBe('monochrome');
    expect(saved.posterReleased).toBe(false);
    expect(await PosterService.listReleased()).toEqual([]);
    expect((await PosterService.listAdmin('admin-token'))[0].posterDraftConfig?.colorPreset).toBe('monochrome');
  });

  it('keeps the released snapshot unchanged while another draft is edited', async () => {
    await PosterService.saveResult('admin-token', 'result-1', { config: released, release: true });
    await PosterService.saveResult('admin-token', 'result-1', { config: draft });
    const publicPosters = await PosterService.listReleased();
    expect(publicPosters).toHaveLength(1);
    expect(publicPosters[0].config.colorPreset).toBe('royal');
    expect(publicPosters[0]).not.toHaveProperty('posterDraftConfig');
    const adminPosters = await PosterService.listAdmin('admin-token');
    expect(adminPosters[0].posterDraftConfig?.colorPreset).toBe('monochrome');
    expect(adminPosters[0].posterPublishedConfig?.colorPreset).toBe('royal');
    expect(harness.documents.get('results/result-1')).toEqual(officialResult);
    expect(harness.documents.get('pointsLedger/result-1_winner')).toEqual({ points: 11, status: 'COMMITTED' });
    expect(harness.writes.every(path => path.startsWith('resultPoster'))).toBe(true);
  });

  it('rejects releasing unpublished or missing official results without writing anything', async () => {
    harness.documents.set('results/result-1', { ...officialResult, resultStatus: 'READY_TO_PUBLISH' });
    await expect(PosterService.saveResult('admin-token', 'result-1', { config: released, release: true })).rejects.toThrow('officially published');
    await expect(PosterService.saveResult('admin-token', 'not-saved', { config: released, release: true })).rejects.toThrow('not found');
    expect(harness.writes).toEqual([]);
  });

  it('removes a withdrawn poster from the public endpoint and retains its draft', async () => {
    await PosterService.saveResult('admin-token', 'result-1', { config: released, release: true });
    await PosterService.saveResult('admin-token', 'result-1', { config: draft, release: false });
    expect(await PosterService.listReleased()).toEqual([]);
    expect((await PosterService.listAdmin('admin-token'))[0].posterDraftConfig?.colorPreset).toBe('monochrome');
    expect(harness.documents.get('resultPosters/result-1')).not.toHaveProperty('config');
  });

  it('hides a released poster when its authoritative result is later revised', async () => {
    await PosterService.saveResult('admin-token', 'result-1', { config: released, release: true });
    harness.documents.set('results/result-1', { ...officialResult, resultStatus: 'REVISION_REQUIRED' });
    expect(await PosterService.listReleased()).toEqual([]);
    expect((await PosterService.listAdmin('admin-token'))[0].posterReleased).toBe(false);
  });

  it('preserves legacy releases on draft save, and a withdrawal cannot restore the legacy poster', async () => {
    harness.documents.set('results/result-1', { ...officialResult, posterReleased: true, posterConfig: released });
    expect((await PosterService.listReleased())[0].config.colorPreset).toBe('royal');
    await PosterService.saveResult('admin-token', 'result-1', { config: draft });
    expect((await PosterService.listReleased())[0].config.colorPreset).toBe('royal');
    await PosterService.saveResult('admin-token', 'result-1', { config: draft, release: false });
    expect(await PosterService.listReleased()).toEqual([]);
  });

  it('persists, reloads and deletes reusable templates without publishing them', async () => {
    const templates = await PosterService.saveTemplate('admin-token', { id: 'template-1', name: '  Festival winners  ', config: draft });
    expect(templates[0]).toMatchObject({ id: 'template-1', name: 'Festival winners', config: { colorPreset: 'monochrome' } });
    expect(await PosterService.listTemplates('admin-token')).toEqual(templates);
    expect(await PosterService.listReleased()).toEqual([]);
    expect(await PosterService.deleteTemplate('admin-token', 'template-1')).toEqual([]);
  });

  it('releases one reusable template for all published results and keeps its public snapshot until updates are released', async () => {
    await PosterService.saveTemplate('admin-token', {
      id: 'global-template', name: 'Festival poster', config: draft,
    });
    expect(await PosterService.listReleasedTemplates()).toEqual([]);

    await PosterService.saveTemplate('admin-token', {
      id: 'global-template', name: 'Festival poster', config: released, released: true,
    });
    const firstRelease = await PosterService.listReleasedTemplates();
    expect(firstRelease).toHaveLength(1);
    expect(firstRelease[0]).toMatchObject({
      id: 'global-template', name: 'Festival poster', released: true,
      config: { colorPreset: 'royal' },
    });

    // Saving editor changes should not silently change the version already released publicly.
    await PosterService.saveTemplate('admin-token', {
      id: 'global-template', name: 'Festival poster', config: draft,
    });
    expect((await PosterService.listReleasedTemplates())[0].config.colorPreset).toBe('royal');
    expect((await PosterService.listTemplates('admin-token'))[0].config.colorPreset).toBe('monochrome');

    // The new version becomes public only when the admin explicitly releases it.
    await PosterService.saveTemplate('admin-token', {
      id: 'global-template', name: 'Festival poster', config: draft, released: true,
    });
    expect((await PosterService.listReleasedTemplates())[0].config.colorPreset).toBe('monochrome');

    await PosterService.saveTemplate('admin-token', {
      id: 'global-template', name: 'Festival poster', config: draft, released: false,
    });
    expect(await PosterService.listReleasedTemplates()).toEqual([]);
  });

  it('rejects invalid config and identifiers and fails closed if storage is unavailable', async () => {
    await expect(PosterService.saveResult('admin-token', '../result-1', { config: draft })).rejects.toThrow('identifier');
    await expect(PosterService.saveResult('admin-token', 'result-1', { config: { ...draft, backgroundImage: 'https://untrusted.test/image.png' } })).rejects.toThrow('Invalid background');
    await expect(PosterService.saveResult('admin-token', 'result-1', { config: draft, release: 'true' })).rejects.toThrow('true or false');
    await expect(PosterService.saveTemplate('admin-token', { id: 'template-1', name: ' ', config: draft })).rejects.toThrow('name');
    expect(harness.writes).toEqual([]);
    harness.available = false;
    await expect(PosterService.saveResult('admin-token', 'result-1', { config: draft })).rejects.toThrow('unavailable');
    await expect(PosterService.listReleased()).rejects.toThrow('unavailable');
  });
});
