import { getAdminDb } from '@/lib/firebase/admin';
import { validatePosterConfig } from '@/domain/poster';
import type { PosterConfig, PosterTemplate } from '@/types/fest';
import { AuthService } from './authService';

export interface PosterMediaRecord {
  resultId: string;
  posterDraftConfig?: PosterConfig;
  posterPublishedConfig?: PosterConfig;
  posterReleased: boolean;
  posterReleasedAt?: string;
  posterUpdatedAt?: string;
}

export interface ReleasedPoster {
  resultId: string;
  config: PosterConfig;
  releasedAt?: string;
}

export interface ReleasedPosterTemplate {
  id: string;
  name: string;
  config: PosterConfig;
  releasedAt?: string;
  updatedAt?: string;
}

function database() {
  const db = getAdminDb();
  if (!db) throw new Error('Poster storage is unavailable. Please try again later.');
  return db;
}

function validateId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value)) {
    throw new Error('Validation error: Invalid poster or template identifier.');
  }
  return value;
}

function storedConfig(value: unknown): PosterConfig | undefined {
  if (!value) return undefined;
  try {
    return validatePosterConfig(value);
  } catch {
    return undefined;
  }
}

/** Poster artwork is deliberately stored apart from official results and scoring. */
export class PosterService {
  static async listReleased(): Promise<ReleasedPoster[]> {
    const db = database();
    const [media, publishedResults] = await Promise.all([
      db.collection('resultPosters').get(),
      db.collection('results').where('resultStatus', '==', 'PUBLISHED').get(),
    ]);
    const mediaById = new Map(media.docs.map(item => [item.id, item.data()]));
    return publishedResults.docs.flatMap(result => {
      const entry = mediaById.get(result.id);
      const legacy = result.data();
      // A modern tombstone takes precedence over legacy poster flags after withdrawal.
      const released = entry ? entry.released === true : legacy.posterReleased === true;
      const config = storedConfig(entry ? entry.config : legacy.posterConfig);
      if (!released || !config) return [];
      const releasedAt = entry?.releasedAt || legacy.posterReleasedAt;
      return [{ resultId: result.id, config, ...(releasedAt ? { releasedAt } : {}) }];
    });
  }

  static async listAdmin(adminIdToken: string): Promise<PosterMediaRecord[]> {
    await AuthService.assertAdmin(adminIdToken);
    const db = database();
    const [drafts, releases, results] = await Promise.all([
      db.collection('resultPosterDrafts').get(),
      db.collection('resultPosters').get(),
      db.collection('results').get(),
    ]);
    const draftById = new Map(drafts.docs.map(item => [item.id, item.data()]));
    const releaseById = new Map(releases.docs.map(item => [item.id, item.data()]));
    return results.docs.map(result => {
      const draft = draftById.get(result.id);
      const release = releaseById.get(result.id);
      const legacy = result.data();
      const released = result.data().resultStatus === 'PUBLISHED' &&
        (release ? release.released === true : legacy.posterReleased === true);
      const publishedConfig = released ? storedConfig(release ? release.config : legacy.posterConfig) : undefined;
      return {
        resultId: result.id,
        posterDraftConfig: storedConfig(draft?.config) || storedConfig(legacy.posterConfig),
        posterPublishedConfig: publishedConfig,
        posterReleased: released && Boolean(publishedConfig),
        posterReleasedAt: released ? release?.releasedAt || legacy.posterReleasedAt : undefined,
        posterUpdatedAt: draft?.updatedAt,
      };
    });
  }

  static async saveResult(
    adminIdToken: string,
    resultId: string,
    input: { config: unknown; release?: unknown },
  ): Promise<PosterMediaRecord> {
    const admin = await AuthService.assertAdmin(adminIdToken);
    const id = validateId(resultId);
    const config = validatePosterConfig(input.config);
    if (input.release !== undefined && typeof input.release !== 'boolean') {
      throw new Error('Validation error: Poster release must be true or false.');
    }
    const db = database();
    const resultRef = db.collection('results').doc(id);
    const draftRef = db.collection('resultPosterDrafts').doc(id);
    const releaseRef = db.collection('resultPosters').doc(id);

    return db.runTransaction(async transaction => {
      const [resultSnapshot, releaseSnapshot] = await Promise.all([
        transaction.get(resultRef), transaction.get(releaseRef),
      ]);
      if (!resultSnapshot.exists) {
        throw new Error('Result not found. Save the official result before creating its poster.');
      }
      const result = resultSnapshot.data()!;
      if (input.release === true && result.resultStatus !== 'PUBLISHED') {
        throw new Error('Validation error: Only an officially published result can have a public poster.');
      }

      const now = new Date().toISOString();
      transaction.set(draftRef, { config, updatedAt: now, updatedBy: admin.uid });
      const previous = releaseSnapshot.data();
      let released = previous ? previous.released === true : result.posterReleased === true;
      let publishedConfig = storedConfig(previous ? previous.config : result.posterConfig);
      let releasedAt: string | undefined = previous?.releasedAt || result.posterReleasedAt;

      if (input.release === true) {
        released = true;
        publishedConfig = config;
        releasedAt = now;
        transaction.set(releaseRef, { released: true, config, releasedAt, releasedBy: admin.uid });
      } else if (input.release === false || result.resultStatus !== 'PUBLISHED') {
        released = false;
        publishedConfig = undefined;
        releasedAt = undefined;
        transaction.set(releaseRef, { released: false, updatedAt: now, updatedBy: admin.uid });
      } else if (!releaseSnapshot.exists) {
        // Preserve a legacy published version while saving a different draft.
        transaction.set(releaseRef, released && publishedConfig
          ? { released: true, config: publishedConfig, releasedAt: releasedAt || now, releasedBy: admin.uid }
          : { released: false, updatedAt: now, updatedBy: admin.uid });
      }

      return {
        resultId: id,
        posterDraftConfig: config,
        posterPublishedConfig: released ? publishedConfig : undefined,
        posterReleased: released && Boolean(publishedConfig),
        posterReleasedAt: releasedAt,
        posterUpdatedAt: now,
      };
    });
  }

  static async listTemplates(adminIdToken: string): Promise<PosterTemplate[]> {
    await AuthService.assertAdmin(adminIdToken);
    return this.readTemplates();
  }

  private static async readTemplates(): Promise<PosterTemplate[]> {
    const snapshot = await database().collection('settings').doc('posterTemplates').collection('items').get();
    return snapshot.docs.flatMap(item => {
      const data = item.data();
      const config = storedConfig(data.config);
      return config ? [{
        id: item.id,
        name: data.name as string,
        config,
        released: data.released === true,
        ...(data.releasedAt ? { releasedAt: data.releasedAt as string } : {}),
        ...(data.updatedAt ? { updatedAt: data.updatedAt as string } : {}),
      }] : [];
    }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  /** Only explicitly released reusable templates are exposed to the public poster gallery. */
  static async listReleasedTemplates(): Promise<ReleasedPosterTemplate[]> {
    const snapshot = await database().collection('settings').doc('posterTemplates')
      .collection('items').where('released', '==', true).get();
    return snapshot.docs.flatMap(item => {
      const data = item.data();
      const config = storedConfig(data.config);
      if (!config || typeof data.name !== 'string' || !data.name.trim() || data.released !== true) return [];
      return [{
        id: item.id,
        name: data.name,
        config,
        ...(data.releasedAt ? { releasedAt: data.releasedAt as string } : {}),
        ...(data.updatedAt ? { updatedAt: data.updatedAt as string } : {}),
      }];
    }).sort((a, b) => (b.releasedAt || b.updatedAt || '').localeCompare(a.releasedAt || a.updatedAt || ''));
  }

  static async saveTemplate(adminIdToken: string, value: unknown): Promise<PosterTemplate[]> {
    const admin = await AuthService.assertAdmin(adminIdToken);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Validation error: A poster template is required.');
    }
    const input = value as Record<string, unknown>;
    const id = validateId(input.id);
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) {
      throw new Error('Validation error: Template name must contain 1 to 80 characters.');
    }
    const config = validatePosterConfig(input.config);
    if (input.released !== undefined && typeof input.released !== 'boolean') {
      throw new Error('Validation error: Template release must be true or false.');
    }
    const ref = database().collection('settings').doc('posterTemplates').collection('items').doc(id);
    const existing = await ref.get();
    const previous = existing.exists ? existing.data()! : undefined;
    const released = input.released === undefined ? previous?.released === true : input.released;
    const now = new Date().toISOString();
    const releasedAt = released
      ? (previous?.released === true && previous?.releasedAt
        ? previous.releasedAt as string
        : now)
      : undefined;
    await ref.set({
      name: input.name.trim(),
      config,
      released,
      ...(releasedAt ? { releasedAt } : {}),
      updatedAt: now,
      updatedBy: admin.uid,
    });
    return this.readTemplates();
  }

  static async deleteTemplate(adminIdToken: string, templateId: string): Promise<PosterTemplate[]> {
    await AuthService.assertAdmin(adminIdToken);
    const id = validateId(templateId);
    await database().collection('settings').doc('posterTemplates').collection('items').doc(id).delete();
    return this.readTemplates();
  }
}
