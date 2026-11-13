import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

export type ResetInventoryFingerprint = {
  firestoreCollections: Record<string, number>;
  firestoreDocuments: number;
  firestoreDocumentVersions: string[];
  authUsers: number;
  authUserFingerprints: string[];
  storageObjects: number;
  storageBytes: number;
  storageObjectVersions: string[];
};

export function assertInventoriesEqual(
  before: ResetInventoryFingerprint,
  after: ResetInventoryFingerprint
): void {
  const normalize = (value: ResetInventoryFingerprint) => JSON.stringify({
    ...value,
    firestoreCollections: Object.fromEntries(
      Object.entries(value.firestoreCollections).sort(([a], [b]) => a.localeCompare(b))
    ),
    firestoreDocumentVersions: [...value.firestoreDocumentVersions].sort(),
    authUserFingerprints: [...value.authUserFingerprints].sort(),
    storageObjectVersions: [...value.storageObjectVersions].sort()
  });

  if (normalize(before) !== normalize(after)) {
    throw new Error(
      'Safety stop: production data changed between the verified backup and deletion preflight. No reset deletion was started.'
    );
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

export async function verifyBackupArtifacts(options: {
  directory: string;
  expectedProject: string;
  expectedBucket: string;
  expectedFirestoreDocuments: number;
  expectedFirestoreCollections: Record<string, number>;
  expectedAuthUsers: number;
  expectedStorageObjects: number;
  expectedStorageBytes: number;
  canonicalAdminUid: string;
}): Promise<void> {
  const {
    directory,
    expectedProject,
    expectedBucket,
    expectedFirestoreDocuments,
    expectedFirestoreCollections,
    expectedAuthUsers,
    expectedStorageObjects,
    expectedStorageBytes,
    canonicalAdminUid
  } = options;

  const firestorePath = path.join(directory, 'firestore_documents.jsonl.gz');
  const authPath = path.join(directory, 'auth_users.json');
  const storageManifestPath = path.join(directory, 'storage_objects.jsonl');
  const backupManifestPath = path.join(directory, 'backup_manifest.json');
  for (const requiredPath of [firestorePath, authPath, storageManifestPath, backupManifestPath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Backup verification failed: ${path.basename(requiredPath)} is missing.`);
    }
  }

  const firestoreReader = createInterface({
    input: createReadStream(firestorePath).pipe(createGunzip()),
    crlfDelay: Infinity
  });
  const firestorePaths = new Set<string>();
  const actualFirestoreCollections: Record<string, number> = {};
  let firestoreCount = 0;
  try {
    for await (const line of firestoreReader) {
      if (!line.trim()) continue;
      let record: { path?: unknown; data?: unknown };
      try {
        record = JSON.parse(line) as { path?: unknown; data?: unknown };
      } catch {
        throw new Error('Firestore gzip contains invalid JSONL.');
      }
      if (typeof record.path !== 'string' || !record.path || !record.data || typeof record.data !== 'object') {
        throw new Error('A Firestore JSONL record is missing its document path or data.');
      }
      if (firestorePaths.has(record.path)) {
        throw new Error(`Duplicate Firestore document path ${record.path}.`);
      }
      const pathSegments = record.path.split('/');
      if (pathSegments.length < 2 || pathSegments.length % 2 !== 0) {
        throw new Error(`Invalid Firestore document path "${record.path}".`);
      }
      const collectionPath = pathSegments.slice(0, -1).join('/');
      actualFirestoreCollections[collectionPath] = (actualFirestoreCollections[collectionPath] || 0) + 1;
      firestorePaths.add(record.path);
      firestoreCount++;
    }
  } catch (error) {
    throw new Error(
      `Backup verification failed: Firestore gzip is corrupt or incomplete (${error instanceof Error ? error.message : String(error)}).`
    );
  }
  if (firestoreCount !== expectedFirestoreDocuments) {
    throw new Error(`Backup verification failed: Firestore record count ${firestoreCount} does not match inventory ${expectedFirestoreDocuments}.`);
  }
  for (const requiredPath of [
    'settings/bootstrapLock',
    `users/${canonicalAdminUid}`,
    'settings/resetMaintenance'
  ]) {
    if (!firestorePaths.has(requiredPath)) {
      throw new Error(`Backup verification failed: required preserved Firestore document "${requiredPath}" is missing.`);
    }
  }
  const sortedCounts = (counts: Record<string, number>) =>
    JSON.stringify(Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b))));
  if (sortedCounts(actualFirestoreCollections) !== sortedCounts(expectedFirestoreCollections)) {
    throw new Error('Backup verification failed: Firestore per-collection counts do not match the locked inventory.');
  }

  let authUsers: Array<{ uid?: unknown }>;
  try {
    authUsers = JSON.parse(await readFile(authPath, 'utf8')) as Array<{ uid?: unknown }>;
  } catch {
    throw new Error('Backup verification failed: Auth JSON export is unreadable or invalid.');
  }
  if (!Array.isArray(authUsers) || authUsers.length !== expectedAuthUsers) {
    throw new Error(`Backup verification failed: Auth export count does not match inventory ${expectedAuthUsers}.`);
  }
  const authUids = authUsers.map(user => user?.uid);
  if (authUids.some(uid => typeof uid !== 'string') || new Set(authUids).size !== authUids.length) {
    throw new Error('Backup verification failed: Auth export contains missing or duplicate UIDs.');
  }
  if (!authUids.includes(canonicalAdminUid)) {
    throw new Error('Backup verification failed: canonical Chief Admin is absent from the Auth export.');
  }

  type StorageManifestItem = {
    name?: unknown;
    backupPath?: unknown;
    size?: unknown;
    sha256?: unknown;
    metadata?: { size?: unknown };
  };
  const storageReader = createInterface({
    input: createReadStream(storageManifestPath),
    crlfDelay: Infinity
  });
  const storageNames = new Set<string>();
  const storagePaths = new Set<string>();
  let storageCount = 0;
  let storageBytes = 0;
  try {
    for await (const line of storageReader) {
      if (!line.trim()) continue;
      let item: StorageManifestItem;
      try {
        item = JSON.parse(line) as StorageManifestItem;
      } catch {
        throw new Error('Storage manifest contains invalid JSONL.');
      }
      if (
        typeof item.name !== 'string' ||
        !item.name ||
        typeof item.backupPath !== 'string' ||
        typeof item.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(item.sha256)
      ) {
        throw new Error('Storage manifest entry is missing name, path or SHA-256.');
      }
      if (storageNames.has(item.name)) {
        throw new Error(`Duplicate Storage object ${item.name}.`);
      }
      storageNames.add(item.name);

      const resolvedPath = path.resolve(directory, item.backupPath);
      const storageRoot = path.resolve(directory, 'storage_objects') + path.sep;
      if (!resolvedPath.startsWith(storageRoot) || storagePaths.has(resolvedPath)) {
        throw new Error('Storage manifest contains an unsafe or duplicate backup path.');
      }
      storagePaths.add(resolvedPath);
      if (!existsSync(resolvedPath)) {
        throw new Error(`Downloaded Storage object for "${item.name}" is missing.`);
      }

      const fileStat = await stat(resolvedPath);
      const manifestSize = Number(item.size);
      const metadataSize = Number(item.metadata?.size);
      if (
        !Number.isSafeInteger(manifestSize) ||
        manifestSize < 0 ||
        fileStat.size !== manifestSize ||
        fileStat.size !== metadataSize
      ) {
        throw new Error(`Storage object size mismatch for "${item.name}".`);
      }
      if (await sha256File(resolvedPath) !== item.sha256) {
        throw new Error(`Storage SHA-256 mismatch for "${item.name}".`);
      }
      storageBytes += fileStat.size;
      storageCount++;
    }
  } catch (error) {
    throw new Error(
      `Backup verification failed: Storage manifest or downloaded file is incomplete (${error instanceof Error ? error.message : String(error)}).`
    );
  }
  if (storageCount !== expectedStorageObjects || storageBytes !== expectedStorageBytes) {
    throw new Error(
      `Backup verification failed: Storage count/bytes (${storageCount}/${storageBytes}) do not match inventory (${expectedStorageObjects}/${expectedStorageBytes}).`
    );
  }

  let manifest: {
    targetProject?: string;
    targetBucket?: string;
    inventoryBeforeReset?: {
      firestoreDocuments?: number;
      firestoreCollections?: Record<string, number>;
      authUsers?: number;
      storageObjects?: number;
      storageBytes?: number;
    };
    verifiedBackup?: {
      firestoreDocumentCount?: number;
      firestoreCollectionCounts?: Record<string, number>;
      authUserCount?: number;
      storageObjectCount?: number;
      storageBytes?: number;
    };
  };
  try {
    manifest = JSON.parse(await readFile(backupManifestPath, 'utf8')) as typeof manifest;
  } catch {
    throw new Error('Backup verification failed: backup_manifest.json is unreadable or invalid.');
  }
  if (manifest.targetProject !== expectedProject || manifest.targetBucket !== expectedBucket) {
    throw new Error('Backup verification failed: manifest target project or Storage bucket does not match the intended production target.');
  }
  if (
    manifest.inventoryBeforeReset?.firestoreDocuments !== expectedFirestoreDocuments ||
    sortedCounts(manifest.inventoryBeforeReset?.firestoreCollections || {}) !== sortedCounts(expectedFirestoreCollections) ||
    manifest.inventoryBeforeReset?.authUsers !== expectedAuthUsers ||
    manifest.inventoryBeforeReset?.storageObjects !== expectedStorageObjects ||
    manifest.inventoryBeforeReset?.storageBytes !== expectedStorageBytes ||
    manifest.verifiedBackup?.firestoreDocumentCount !== expectedFirestoreDocuments ||
    sortedCounts(manifest.verifiedBackup?.firestoreCollectionCounts || {}) !== sortedCounts(actualFirestoreCollections) ||
    manifest.verifiedBackup?.authUserCount !== expectedAuthUsers ||
    manifest.verifiedBackup?.storageObjectCount !== expectedStorageObjects ||
    manifest.verifiedBackup?.storageBytes !== expectedStorageBytes
  ) {
    throw new Error('Backup verification failed: backup manifest counts/bytes do not reconcile with the verified files and inventory.');
  }
}
