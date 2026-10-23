import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

interface InventoryItem {
  collection: string;
  count: number;
  docIds: string[];
  subcollections?: {
    parentDocId: string;
    subcollection: string;
    count: number;
    docIds: string[];
  }[];
}

async function runDryRunAndBackup() {
  const TARGET_PROJECT = 'inspirath-d6778';
  console.log(`================================================================`);
  console.log(`TASK 1: PRODUCTION INVENTORY, DRY-RUN & BACKUP`);
  console.log(`Target Firebase Project: ${TARGET_PROJECT}`);
  console.log(`Mode: READ-ONLY (No deletions will be performed)`);
  console.log(`================================================================\n`);

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account not found at: ${serviceAccountPath}`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (serviceAccount.project_id !== TARGET_PROJECT) {
    throw new Error(`Project ID mismatch: expected ${TARGET_PROJECT}, found ${serviceAccount.project_id}`);
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: TARGET_PROJECT,
    storageBucket: 'inspirath-d6778.firebasestorage.app'
  }, 'reset-dry-run-backup-app');

  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups', `production_pre_reset_backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`[1/4] Preparing secure recovery backup at:\n  ${backupDir}\n`);

  // 1. INVENTORY & BACKUP AUTH USERS
  console.log(`[2/4] Inspecting Firebase Authentication Users...`);
  const authUsers: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    authUsers.push(...listResult.users);
    pageToken = listResult.pageToken;
  } while (pageToken);

  fs.writeFileSync(
    path.join(backupDir, 'auth_users.json'),
    JSON.stringify(authUsers.map(u => u.toJSON()), null, 2),
    'utf8'
  );

  let chiefAdminAuth: any = null;
  const nonAdminAuthUsers: any[] = [];

  for (const u of authUsers) {
    const claims = u.customClaims || {};
    if (claims.role === 'ADMIN' || u.email?.includes('admin')) {
      chiefAdminAuth = u;
    } else {
      nonAdminAuthUsers.push(u);
    }
  }

  console.log(`  - Total Auth Users: ${authUsers.length}`);
  if (chiefAdminAuth) {
    console.log(`  - Preserved Chief Admin: ${chiefAdminAuth.email} (UID: ${chiefAdminAuth.uid})`);
    console.log(`    Claims: ${JSON.stringify(chiefAdminAuth.customClaims)}`);
  } else {
    console.warn(`  - [WARNING] No user with explicit role: ADMIN found in Auth!`);
  }
  console.log(`  - Non-Admin Users: ${nonAdminAuthUsers.length}`);

  // 2. INVENTORY & BACKUP FIRESTORE COLLECTIONS
  console.log(`\n[3/4] Inspecting and Backing Up Firestore Collections...`);

  const collectionsToInspect = [
    'categories',
    'teams',
    'competitions',
    'participants',
    'registrations',
    'stages',
    'schedules',
    'judges',
    'judgeAssignments',
    'markEntries',
    'results',
    'pointsLedger',
    'leaderboard',
    'mediaTemplates',
    'generatedPosters',
    'settings',
    'users',
    'auditLogs'
  ];

  // Discover all root collections dynamically as well
  const allRootCollections = await db.listCollections();
  const allCollectionNames = Array.from(new Set([
    ...collectionsToInspect,
    ...allRootCollections.map(c => c.id)
  ]));

  const inventory: InventoryItem[] = [];
  const backupSummary: Record<string, number> = {};

  for (const colName of allCollectionNames) {
    const snap = await db.collection(colName).get();
    const docIds = snap.docs.map(d => d.id);
    const item: InventoryItem = {
      collection: colName,
      count: snap.size,
      docIds
    };

    // Backup documents to file
    const docData = snap.docs.map(d => ({
      _id: d.id,
      _path: d.ref.path,
      ...d.data()
    }));
    fs.writeFileSync(
      path.join(backupDir, `firestore_${colName}.json`),
      JSON.stringify(docData, null, 2),
      'utf8'
    );
    backupSummary[colName] = snap.size;

    // Check for nested subcollections on teams (e.g. /teams/{teamId}/private)
    if (colName === 'teams') {
      item.subcollections = [];
      for (const teamDoc of snap.docs) {
        const subcols = await teamDoc.ref.listCollections();
        for (const subcol of subcols) {
          const subSnap = await subcol.get();
          if (subSnap.size > 0) {
            item.subcollections.push({
              parentDocId: teamDoc.id,
              subcollection: subcol.id,
              count: subSnap.size,
              docIds: subSnap.docs.map(d => d.id)
            });
            const subDocData = subSnap.docs.map(d => ({
              _id: d.id,
              _path: d.ref.path,
              ...d.data()
            }));
            fs.writeFileSync(
              path.join(backupDir, `firestore_teams_${teamDoc.id}_${subcol.id}.json`),
              JSON.stringify(subDocData, null, 2),
              'utf8'
            );
          }
        }
      }
    }

    inventory.push(item);
    console.log(`  - Collection '${colName}': ${snap.size} document(s) backed up.`);
    if (item.subcollections && item.subcollections.length > 0) {
      for (const sub of item.subcollections) {
        console.log(`    ↳ Subcollection teams/${sub.parentDocId}/${sub.subcollection}: ${sub.count} doc(s)`);
      }
    }
  }

  // 3. INVENTORY & BACKUP CLOUD STORAGE OBJECTS
  console.log(`\n[4/4] Inspecting Cloud Storage Files in bucket 'inspirath-d6778.firebasestorage.app'...`);
  const storageFiles: { name: string; size: string; contentType?: string }[] = [];
  try {
    const bucket = storage.bucket('inspirath-d6778.firebasestorage.app');
    const [files] = await bucket.getFiles({ maxResults: 1000 });
    for (const f of files) {
      storageFiles.push({
        name: f.name,
        size: `${f.metadata.size || 0} bytes`,
        contentType: f.metadata.contentType
      });
    }
    fs.writeFileSync(
      path.join(backupDir, 'storage_files_inventory.json'),
      JSON.stringify(storageFiles, null, 2),
      'utf8'
    );
    console.log(`  - Found ${storageFiles.length} storage file(s) in bucket.`);
    storageFiles.forEach(f => console.log(`    ↳ File: ${f.name} (${f.size})`));
  } catch (storageErr) {
    console.warn(`  - Storage inspection note:`, storageErr);
  }

  // Generate audit manifest
  const manifest = {
    targetProject: TARGET_PROJECT,
    backupTimestamp: new Date().toISOString(),
    backupDirectory: backupDir,
    authUsersCount: authUsers.length,
    chiefAdminUid: chiefAdminAuth?.uid || null,
    chiefAdminEmail: chiefAdminAuth?.email || null,
    storageFilesCount: storageFiles.length,
    collections: backupSummary
  };
  fs.writeFileSync(path.join(backupDir, 'audit_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n================================================================`);
  console.log(`READ-ONLY DRY-RUN INVENTORY COMPLETED`);
  console.log(`Backup saved to: ${backupDir}`);
  console.log(`================================================================`);
}

runDryRunAndBackup().catch(err => {
  console.error('Dry-run inspection failed:', err);
  process.exit(1);
});
