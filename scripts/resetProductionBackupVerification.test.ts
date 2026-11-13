import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertInventoriesEqual, verifyBackupArtifacts } from './resetProductionBackupVerification';

const adminUid = 'chief-admin-uid';
const objectBytes = Buffer.from('verified participant image bytes');
const digest = createHash('sha256').update(objectBytes).digest('hex');

describe('fresh-fest reset backup safeguards', () => {
  let directory = '';

  async function createBackup() {
    directory = await mkdtemp(path.join(tmpdir(), 'inspirath-reset-'));
    await mkdir(path.join(directory, 'storage_objects'));
    const firestoreRecords = [
      { path: 'settings/bootstrapLock', data: { adminUid, maintenanceMode: true } },
      { path: 'users/chief-admin-uid', data: { role: 'ADMIN', status: 'ACTIVE' } }
    ];
    await writeFile(
      path.join(directory, 'firestore_documents.jsonl.gz'),
      gzipSync(firestoreRecords.map(record => JSON.stringify(record)).join('\n') + '\n')
    );
    await writeFile(
      path.join(directory, 'auth_users.json'),
      JSON.stringify([{ uid: adminUid, customClaims: { role: 'ADMIN' } }])
    );
    await writeFile(path.join(directory, 'storage_objects', 'file-1'), objectBytes);
    await writeFile(
      path.join(directory, 'storage_objects.jsonl'),
      JSON.stringify({
        name: 'branding/logo.png',
        backupPath: 'storage_objects/file-1',
        size: objectBytes.length,
        sha256: digest,
        metadata: { size: String(objectBytes.length) }
      }) + '\n'
    );
    const manifest = {
      targetProject: 'inspirath-d6778',
      targetBucket: 'inspirath-d6778.firebasestorage.app',
      inventoryBeforeReset: {
        firestoreCollections: { settings: 1, users: 1 },
        firestoreDocuments: 2,
        authUsers: 1,
        storageObjects: 1,
        storageBytes: objectBytes.length
      },
      verifiedBackup: {
        firestoreCollectionCounts: { settings: 1, users: 1 },
        firestoreDocumentCount: 2,
        authUserCount: 1,
        storageObjectCount: 1,
        storageBytes: objectBytes.length
      }
    };
    await writeFile(path.join(directory, 'backup_manifest.json'), JSON.stringify(manifest));
  }

  beforeEach(createBackup);
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  const options = () => ({
    directory,
    expectedProject: 'inspirath-d6778',
    expectedBucket: 'inspirath-d6778.firebasestorage.app',
    expectedFirestoreDocuments: 2,
    expectedFirestoreCollections: { settings: 1, users: 1 },
    expectedAuthUsers: 1,
    expectedStorageObjects: 1,
    expectedStorageBytes: objectBytes.length,
    canonicalAdminUid: adminUid
  });

  it('accepts readable Firestore gzip, Auth JSON and every verified Storage object', async () => {
    await expect(verifyBackupArtifacts(options())).resolves.toBeUndefined();
  });

  it('rejects corrupt Firestore gzip before any deletion', async () => {
    await writeFile(path.join(directory, 'firestore_documents.jsonl.gz'), Buffer.from('not a gzip file'));
    await expect(verifyBackupArtifacts(options())).rejects.toThrow(/Firestore gzip/);
  });

  it('rejects a backup missing the preserved Chief Admin Firestore profile', async () => {
    const records = [
      { path: 'settings/bootstrapLock', data: { adminUid, maintenanceMode: true } },
      { path: 'users/other-admin', data: { role: 'ADMIN', status: 'ACTIVE' } }
    ];
    await writeFile(
      path.join(directory, 'firestore_documents.jsonl.gz'),
      gzipSync(records.map(record => JSON.stringify(record)).join('\n') + '\n')
    );
    await expect(verifyBackupArtifacts(options())).rejects.toThrow(/required preserved Firestore document/);
  });

  it('rejects an Auth export that omits the canonical Chief Admin', async () => {
    await writeFile(path.join(directory, 'auth_users.json'), JSON.stringify([{ uid: 'other-user' }]));
    await expect(verifyBackupArtifacts(options())).rejects.toThrow(/Chief Admin/);
  });

  it('rejects Storage object corruption even when the file still exists', async () => {
    await writeFile(path.join(directory, 'storage_objects', 'file-1'), Buffer.from('VERIFIED participant image bytes'));
    await expect(verifyBackupArtifacts(options())).rejects.toThrow(/SHA-256 mismatch/);
  });

  it('gates every Firestore and Storage client write grant during maintenance', async () => {
    const [firestoreRules, storageRules] = await Promise.all([
      readFile(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      readFile(path.resolve(process.cwd(), 'storage.rules'), 'utf8')
    ]);
    const writeGrants = (rules: string) =>
      rules.split('allow ').slice(1)
        .map(rule => rule.slice(0, rule.indexOf(';') < 0 ? rule.length : rule.indexOf(';')))
        .filter(rule => rule.split(':', 1)[0].split(',').some(
          action => ['write', 'create', 'update', 'delete'].includes(action.trim())
        ));

    const firestoreWrites = writeGrants(firestoreRules);
    const storageWrites = writeGrants(storageRules);
    expect(firestoreWrites.length).toBeGreaterThan(0);
    expect(storageWrites.length).toBeGreaterThan(0);
    for (const grant of firestoreWrites) {
      expect(grant).toContain('!isResetMaintenanceActive()');
    }
    for (const grant of storageWrites) {
      expect(grant).toContain('isResetMaintenanceInactive()');
    }
  });

  it('rejects changes to the Firestore/Auth inventory after backup', () => {
    const baseline = {
      firestoreCollections: { users: 1 },
      firestoreDocuments: 1,
      firestoreDocumentVersions: ['users/admin:1'],
      authUsers: 1,
      authUserFingerprints: ['admin:a'],
      storageObjects: 0,
      storageBytes: 0,
      storageObjectVersions: []
    };
    expect(() => assertInventoriesEqual(
      baseline,
      { ...baseline, firestoreDocumentVersions: ['users/admin:2'] }
    )).toThrow(/changed between the verified backup and deletion/);
    expect(() => assertInventoriesEqual(
      baseline,
      { ...baseline, authUserFingerprints: ['admin:b'] }
    )).toThrow(/changed between the verified backup and deletion/);
  });
});
