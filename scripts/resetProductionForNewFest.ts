/**
 * Production reset for a new fest.
 *
 * Safe by default: runs a read-only inventory unless --execute is supplied.
 * Execution requires a complete local backup and an exact interactive confirmation.
 *
 * Preserves only:
 *   - The single canonical Chief Admin Auth account
 *   - users/{ChiefAdminUid}
 *   - settings/bootstrapLock
 *
 * Removes all other Firestore documents (including nested subcollections), all other
 * Firebase Auth accounts, and every object in the production Storage bucket.
 *
 * Run from the repository root on the administrator workstation:
 *   npm run reset:production
 *   npm run reset:production -- --execute
 */

import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type CollectionReference, type DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket as StorageBucket, File as StorageFile } from '@google-cloud/storage';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { once } from 'node:events';
import { createGzip, type Gzip } from 'node:zlib';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const TARGET_PROJECT = 'inspirath-d6778';
const TARGET_BUCKET = 'inspirath-d6778.firebasestorage.app';
const DEFAULT_SERVICE_ACCOUNT_PATH = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
const PRESERVED_LOCK_PATH = 'settings/bootstrapLock';
const RESET_CONFIRMATION = 'RESET_INSPIRATH_PRODUCTION';

type StorageFileList = StorageFile[];

type Inventory = {
  firestoreCollections: Record<string, number>;
  firestoreDocuments: number;
  authUsers: number;
  storageObjects: number;
  storageBytes: number;
};

function assertNoEmulatorEnvironment(): void {
  const emulatorVars = [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST'
  ];
  const active = emulatorVars.filter(key => Boolean(process.env[key]?.trim()));
  if (active.length) {
    throw new Error(
      `Refusing to target production while emulator variables are set: ${active.join(', ')}. Remove them from this terminal and retry.`
    );
  }
}

function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value)) return { $type: 'bytes', base64: value.toString('base64') };
  if (value instanceof Uint8Array) return { $type: 'bytes', base64: Buffer.from(value).toString('base64') };
  if (value instanceof Date) return { $type: 'date', iso: value.toISOString() };

  if (Array.isArray(value)) return value.map(serializeFirestoreValue);

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;

    if (constructorName === 'Timestamp' && typeof record.seconds === 'number') {
      return { $type: 'timestamp', seconds: record.seconds, nanoseconds: record.nanoseconds };
    }
    if (constructorName === 'GeoPoint' && typeof record.latitude === 'number') {
      return { $type: 'geopoint', latitude: record.latitude, longitude: record.longitude };
    }
    if (
      constructorName === 'DocumentReference' &&
      typeof record.path === 'string'
    ) {
      return { $type: 'reference', path: record.path };
    }

    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      output[key] = serializeFirestoreValue(nested);
    }
    return output;
  }

  return value;
}

async function listAllAuthUsers(auth: ReturnType<typeof getAuth>): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function countCollectionTree(
  collectionRef: CollectionReference,
  counts: Record<string, number>
): Promise<number> {
  // listDocuments() also returns references for missing parent documents whose
  // subcollections still contain records. Those orphaned paths must be counted.
  const documentRefs = await collectionRef.listDocuments();
  let total = 0;
  for (const documentRef of documentRefs) {
    const document = await documentRef.get();
    if (document.exists) total++;
    const childCollections = await documentRef.listCollections();
    for (const child of childCollections) {
      total += await countCollectionTree(child, counts);
    }
  }
  counts[collectionRef.path] = (counts[collectionRef.path] || 0) + total;
  return total;
}

async function buildInventory(
  db: ReturnType<typeof getFirestore>,
  auth: ReturnType<typeof getAuth>,
  bucket: StorageBucket
): Promise<{ inventory: Inventory; authUsers: UserRecord[]; storageFiles: StorageFileList }> {
  const collectionCounts: Record<string, number> = {};
  let firestoreDocuments = 0;
  const rootCollections = await db.listCollections();
  for (const collectionRef of rootCollections) {
    firestoreDocuments += await countCollectionTree(collectionRef, collectionCounts);
  }

  const authUsers = await listAllAuthUsers(auth);
  const [storageFiles] = await bucket.getFiles({ autoPaginate: true });
  let storageBytes = 0;
  for (let offset = 0; offset < storageFiles.length; offset += 20) {
    const batch = storageFiles.slice(offset, offset + 20);
    const metadata = await Promise.all(batch.map(file => file.getMetadata()));
    storageBytes += metadata.reduce((sum, [item]) => sum + Number(item.size || 0), 0);
  }

  return {
    inventory: {
      firestoreCollections: collectionCounts,
      firestoreDocuments,
      authUsers: authUsers.length,
      storageObjects: storageFiles.length,
      storageBytes
    },
    authUsers,
    storageFiles
  };
}

async function assertCanonicalAdmin(
  db: ReturnType<typeof getFirestore>,
  auth: ReturnType<typeof getAuth>
): Promise<{ uid: string; userRecord: UserRecord }> {
  const lockSnapshot = await db.doc(PRESERVED_LOCK_PATH).get();
  if (!lockSnapshot.exists) {
    throw new Error('Safety stop: settings/bootstrapLock is missing. No data was changed.');
  }

  const lock = lockSnapshot.data() || {};
  const adminUid = typeof lock.adminUid === 'string' ? lock.adminUid : '';
  if (!adminUid || lock.status !== 'COMMITTED' || lock.isLocked !== true) {
    throw new Error('Safety stop: bootstrapLock is not a committed lock with an adminUid. No data was changed.');
  }

  const adminsSnapshot = await db.collection('users').where('role', '==', 'ADMIN').get();
  if (adminsSnapshot.size !== 1 || adminsSnapshot.docs[0]?.id !== adminUid) {
    throw new Error(
      `Safety stop: expected exactly one Firestore ADMIN matching bootstrapLock.adminUid; found ${adminsSnapshot.size}. No data was changed.`
    );
  }

  const adminDoc = adminsSnapshot.docs[0].data();
  if (adminDoc.status !== 'ACTIVE' || adminDoc.disabled === true) {
    throw new Error('Safety stop: canonical Chief Admin Firestore user is not ACTIVE. No data was changed.');
  }

  const adminRecord = await auth.getUser(adminUid);
  if (adminRecord.disabled || adminRecord.customClaims?.role !== 'ADMIN') {
    throw new Error('Safety stop: canonical Chief Admin Auth account is disabled or lacks the ADMIN claim. No data was changed.');
  }

  return { uid: adminUid, userRecord: adminRecord };
}

async function writeGzipLine(stream: Gzip, value: unknown): Promise<void> {
  if (!stream.write(JSON.stringify(value) + '\n')) {
    await once(stream, 'drain');
  }
}

async function backupFirestore(
  db: ReturnType<typeof getFirestore>,
  destination: string
): Promise<{ documentCount: number; collectionCounts: Record<string, number> }> {
  const outputPath = path.join(destination, 'firestore_documents.jsonl.gz');
  const output = createWriteStream(outputPath);
  const gzip = createGzip({ level: 9 });
  gzip.pipe(output);
  const outputFinished = finished(output);
  const collectionCounts: Record<string, number> = {};
  let documentCount = 0;

  const exportCollection = async (collectionRef: CollectionReference): Promise<void> => {
    // Traverse document references rather than only existing documents so records
    // below deleted/missing parent documents are backed up too.
    const documentRefs = await collectionRef.listDocuments();
    let existingDocuments = 0;

    for (const documentRef of documentRefs) {
      const document = await documentRef.get();
      if (document.exists) {
        const record = {
          path: document.ref.path,
          data: serializeFirestoreValue(document.data())
        };
        await writeGzipLine(gzip, record);
        documentCount++;
        existingDocuments++;
      }

      const childCollections = await documentRef.listCollections();
      for (const child of childCollections) {
        await exportCollection(child);
      }
    }

    collectionCounts[collectionRef.path] = (collectionCounts[collectionRef.path] || 0) + existingDocuments;
  };

  try {
    const roots = await db.listCollections();
    for (const root of roots) {
      await exportCollection(root);
    }
    gzip.end();
    await outputFinished;
  } catch (error) {
    gzip.destroy();
    output.destroy();
    throw error;
  }

  return { documentCount, collectionCounts };
}

async function backupStorage(
  files: StorageFileList,
  destination: string
): Promise<number> {
  const storageDir = path.join(destination, 'storage_objects');
  mkdirSync(storageDir, { recursive: true });
  const manifestPath = path.join(destination, 'storage_objects.jsonl');
  const manifest = createWriteStream(manifestPath, { encoding: 'utf8' });
  let count = 0;

  try {
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const hash = createHash('sha256').update(file.name).digest('hex');
      const relativeBackupPath = path.posix.join('storage_objects', hash);
      const absoluteBackupPath = path.join(destination, relativeBackupPath);
      await file.download({ destination: absoluteBackupPath });

      const localStat = await stat(absoluteBackupPath);
      const expectedSize = Number(metadata.size || 0);
      if (localStat.size !== expectedSize) {
        throw new Error(
          `Storage backup size mismatch for an object (expected ${expectedSize}, downloaded ${localStat.size}). Backup is incomplete.`
        );
      }

      const item = {
        name: file.name,
        backupPath: relativeBackupPath,
        metadata
      };
      if (!manifest.write(JSON.stringify(item) + '\n')) {
        await once(manifest, 'drain');
      }
      count++;
    }
    manifest.end();
    await finished(manifest);
  } catch (error) {
    manifest.destroy();
    throw error;
  }

  return count;
}

async function writeBackup(
  db: ReturnType<typeof getFirestore>,
  auth: ReturnType<typeof getAuth>,
  bucket: StorageBucket,
  inventory: Inventory,
  authUsers: UserRecord[],
  storageFiles: StorageFileList
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDirectory = path.resolve(process.cwd(), 'backups', `production_fest_reset_${timestamp}`);
  mkdirSync(backupDirectory, { recursive: true });

  const firestoreBackup = await backupFirestore(db, backupDirectory);
  if (firestoreBackup.documentCount !== inventory.firestoreDocuments) {
    throw new Error(
      `Firestore changed while backing up: inventory had ${inventory.firestoreDocuments} documents but backup contains ${firestoreBackup.documentCount}. No deletion was performed.`
    );
  }

  writeFileSync(
    path.join(backupDirectory, 'auth_users.json'),
    JSON.stringify(authUsers.map(user => user.toJSON()), null, 2),
    'utf8'
  );

  const storageBackupCount = await backupStorage(storageFiles, backupDirectory);
  if (storageBackupCount !== inventory.storageObjects) {
    throw new Error(
      `Storage changed while backing up: inventory had ${inventory.storageObjects} objects but backup contains ${storageBackupCount}. No deletion was performed.`
    );
  }

  const manifest = {
    targetProject: TARGET_PROJECT,
    targetBucket: TARGET_BUCKET,
    backupCreatedAt: new Date().toISOString(),
    purpose: 'Pre-reset backup before starting a new fest',
    preserved: {
      chiefAdminUid: 'present in settings/bootstrapLock.adminUid',
      firestoreDocuments: ['users/{ChiefAdminUid}', 'settings/bootstrapLock'],
      authAccount: 'canonical Chief Admin only'
    },
    inventoryBeforeReset: inventory,
    verifiedBackup: {
      firestoreDocumentCount: firestoreBackup.documentCount,
      firestoreCollectionCounts: firestoreBackup.collectionCounts,
      authUserCount: authUsers.length,
      storageObjectCount: storageBackupCount
    },
    files: [
      'firestore_documents.jsonl.gz',
      'auth_users.json',
      'storage_objects.jsonl',
      'storage_objects/*'
    ]
  };
  writeFileSync(path.join(backupDirectory, 'backup_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Ensure the written backup files are present before the script can enter destructive mode.
  for (const requiredFile of ['firestore_documents.jsonl.gz', 'auth_users.json', 'storage_objects.jsonl', 'backup_manifest.json']) {
    if (!existsSync(path.join(backupDirectory, requiredFile))) {
      throw new Error(`Backup verification failed: ${requiredFile} is missing. No deletion was performed.`);
    }
  }

  console.log(`\n[BACKUP VERIFIED] ${backupDirectory}`);
  return backupDirectory;
}

async function deleteAllFirestoreExceptCanonicalAdmin(
  db: ReturnType<typeof getFirestore>,
  adminUid: string
): Promise<number> {
  let deletedDocuments = 0;
  const roots = await db.listCollections();

  for (const root of roots) {
    const documentRefs = await root.listDocuments();
    for (const documentRef of documentRefs) {
      const preserveAdmin = documentRef.path === `users/${adminUid}`;
      const preserveBootstrapLock = documentRef.path === PRESERVED_LOCK_PATH;

      if (preserveAdmin || preserveBootstrapLock) {
        const subcollections = await documentRef.listCollections();
        for (const subcollection of subcollections) {
          const count = await countCollectionTree(subcollection, {});
          await db.recursiveDelete(subcollection);
          deletedDocuments += count;
        }
        continue;
      }

      const count = await countCollectionTreeForDocument(documentRef);
      await db.recursiveDelete(documentRef);
      deletedDocuments += count;
    }
  }

  return deletedDocuments;
}

async function countCollectionTreeForDocument(documentRef: DocumentReference): Promise<number> {
  const snapshot = await documentRef.get();
  let total = snapshot.exists ? 1 : 0;
  const subcollections = await documentRef.listCollections();
  for (const child of subcollections) {
    total += await countCollectionTree(child, {});
  }
  return total;
}

async function deleteAllStorageObjects(files: StorageFileList): Promise<number> {
  let deleted = 0;
  for (const file of files) {
    await file.delete({ ignoreNotFound: true });
    deleted++;
  }
  return deleted;
}

async function deleteAllAuthUsersExceptAdmin(
  auth: ReturnType<typeof getAuth>,
  users: UserRecord[],
  adminUid: string
): Promise<number> {
  const targets = users.filter(user => user.uid !== adminUid);
  let deleted = 0;

  for (let offset = 0; offset < targets.length; offset += 1000) {
    const chunk = targets.slice(offset, offset + 1000);
    const result = await auth.deleteUsers(chunk.map(user => user.uid));
    if (result.failureCount > 0) {
      const failedCodes = result.errors.map(item => item.error.code);
      throw new Error(
        `Firebase Auth deleted ${result.successCount} account(s) but ${result.failureCount} failed (${failedCodes.join(', ')}). Manual review is required.`
      );
    }
    deleted += result.successCount;
  }

  return deleted;
}

async function verifyFreshState(
  db: ReturnType<typeof getFirestore>,
  auth: ReturnType<typeof getAuth>,
  bucket: StorageBucket,
  adminUid: string
): Promise<void> {
  const remainingCounts: Record<string, number> = {};
  let remainingDocuments = 0;
  const roots = await db.listCollections();
  for (const root of roots) {
    remainingDocuments += await countCollectionTree(root, remainingCounts);
  }

  const [remainingAuthUsers, remainingStorage] = await Promise.all([
    listAllAuthUsers(auth),
    bucket.getFiles({ autoPaginate: true })
  ]);

  const expectedPaths = ['settings/bootstrapLock', `users/${adminUid}`].sort();
  const remainingPaths: string[] = [];
  for (const root of await db.listCollections()) {
    const snapshot = await root.get();
    for (const document of snapshot.docs) {
      remainingPaths.push(document.ref.path);
      if ((await document.ref.listCollections()).length > 0) {
        throw new Error(`Fresh-state verification failed: nested data remains under ${document.ref.path}.`);
      }
    }
  }

  if (remainingDocuments !== 2 || remainingPaths.sort().join('|') !== expectedPaths.join('|')) {
    throw new Error(
      `Fresh-state verification failed: expected only ${expectedPaths.join(', ')}; found ${remainingDocuments} Firestore documents.`
    );
  }
  if (remainingAuthUsers.length !== 1 || remainingAuthUsers[0].uid !== adminUid) {
    throw new Error(`Fresh-state verification failed: expected only the canonical Chief Admin Auth account; found ${remainingAuthUsers.length}.`);
  }
  if (remainingStorage[0].length !== 0) {
    throw new Error(`Fresh-state verification failed: ${remainingStorage[0].length} Storage objects remain.`);
  }
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  assertNoEmulatorEnvironment();

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_SERVICE_ACCOUNT_PATH;
  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Production service account file not found at "${serviceAccountPath}". Set FIREBASE_SERVICE_ACCOUNT_PATH to the correct local JSON file path.`
    );
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (serviceAccount.project_id !== TARGET_PROJECT || typeof serviceAccount.client_email !== 'string' || typeof serviceAccount.private_key !== 'string') {
    throw new Error(`Safety stop: service account must be a valid credential for exactly ${TARGET_PROJECT}.`);
  }

  const app = initializeApp({
    credential: cert({ projectId: TARGET_PROJECT, clientEmail: serviceAccount.client_email, privateKey: serviceAccount.private_key }),
    projectId: TARGET_PROJECT,
    storageBucket: TARGET_BUCKET
  }, `fresh-fest-reset-${Date.now()}`);

  const auth = getAuth(app);
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket(TARGET_BUCKET);

  try {
    const [bucketMetadata] = await bucket.getMetadata();
    if (bucketMetadata.name !== TARGET_BUCKET) {
      throw new Error(`Safety stop: Storage bucket mismatch. Expected ${TARGET_BUCKET}, received ${bucketMetadata.name}.`);
    }

    const canonicalAdmin = await assertCanonicalAdmin(db, auth);
    const { inventory, authUsers, storageFiles } = await buildInventory(db, auth, bucket);

    console.log('\n=== INSPIRATH PRODUCTION FRESH-FEST RESET ===');
    console.log(`Target project: ${TARGET_PROJECT}`);
    console.log(`Storage bucket: ${TARGET_BUCKET}`);
    console.log(`Canonical Chief Admin: ${canonicalAdmin.uid.slice(0, 7)}… (preserved)`);
    console.log('\nFirestore documents by collection:');
    for (const [name, count] of Object.entries(inventory.firestoreCollections).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${name}: ${count}`);
    }
    console.log(`Firestore documents total (including nested): ${inventory.firestoreDocuments}`);
    console.log(`Firebase Auth accounts: ${inventory.authUsers} (1 preserved)`);
    console.log(`Storage objects: ${inventory.storageObjects} (${inventory.storageBytes.toLocaleString('en-IN')} bytes)`);
    console.log('\nWill preserve only the canonical Chief Admin account, users/{ChiefAdminUid}, and settings/bootstrapLock.');
    console.log('Will remove all other Firestore documents/subcollections, all Storage objects, and all other Auth accounts.');

    if (!execute) {
      console.log('\n[DRY RUN ONLY] Nothing was deleted or modified.');
      console.log('Review the counts, then run: npm run reset:production -- --execute');
      return;
    }

    if (!stdin.isTTY) {
      throw new Error('Destructive execution requires an interactive terminal (TTY). No data was deleted.');
    }

    console.log('\n[WARNING] This permanently removes current fest records, non-admin accounts, and Storage files from production.');
    console.log('A complete local backup will be written before the first deletion.');
    const readline = createInterface({ input: stdin, output: stdout });
    let confirmation = '';
    try {
      confirmation = await readline.question(`Type ${RESET_CONFIRMATION} to proceed: `);
    } finally {
      readline.close();
    }

    if (confirmation.trim() !== RESET_CONFIRMATION) {
      console.log('Confirmation did not match. No data was deleted.');
      return;
    }

    const backupDirectory = await writeBackup(db, auth, bucket, inventory, authUsers, storageFiles);

    console.log('\n[RESET] Removing all old Firestore data except the canonical Admin and bootstrap lock…');
    const firestoreDeleted = await deleteAllFirestoreExceptCanonicalAdmin(db, canonicalAdmin.uid);

    console.log('[RESET] Removing all production Storage objects…');
    const storageDeleted = await deleteAllStorageObjects(storageFiles);

    console.log('[RESET] Removing all Firebase Auth accounts except the canonical Chief Admin…');
    const authDeleted = await deleteAllAuthUsersExceptAdmin(auth, authUsers, canonicalAdmin.uid);

    console.log('\n[VERIFY] Checking the clean production state…');
    await verifyFreshState(db, auth, bucket, canonicalAdmin.uid);

    console.log('\n=== FRESH-FEST RESET COMPLETE ===');
    console.log(`Firestore documents removed: ${firestoreDeleted}`);
    console.log(`Storage objects removed: ${storageDeleted}`);
    console.log(`Firebase Auth accounts removed: ${authDeleted}`);
    console.log('Preserved: Chief Admin login, users/{ChiefAdminUid}, settings/bootstrapLock.');
    console.log('Cleared: festival identity/theme, categories, teams, competitions, participants, registrations, stages, schedules, judges, marks, results, ledger, posters, logos, exports and all other stored objects.');
    console.log(`Backup: ${backupDirectory}`);
  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  console.error('\n[FRESH-FEST RESET ABORTED]', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
