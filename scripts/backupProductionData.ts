import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function performBackup() {
  const TARGET_PROJECT = 'inspirath-d6778';
  console.log(`=== PHASE A PRE-RECOVERY BACKUP: Target Project: ${TARGET_PROJECT} ===\n`);

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account not found: ${serviceAccountPath}`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (serviceAccount.project_id !== TARGET_PROJECT) {
    throw new Error(`Service account project ID mismatch: expected ${TARGET_PROJECT}, got ${serviceAccount.project_id}`);
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: TARGET_PROJECT
  }, 'backup-app');

  const auth = getAuth(app);
  const db = getFirestore(app);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups', `phase_a_recovery_backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`Preserving secure backup to: ${backupDir}\n`);

  // 1. Auth Users
  const authUsers: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    authUsers.push(...listResult.users.map(u => u.toJSON()));
    pageToken = listResult.pageToken;
  } while (pageToken);

  fs.writeFileSync(path.join(backupDir, 'auth_users.json'), JSON.stringify(authUsers, null, 2), 'utf8');
  console.log(`[Backup] Preserved ${authUsers.length} Auth users.`);

  // 2. Collections
  const collectionsToBackup = ['users', 'competitions', 'judgeAssignments', 'markEntries', 'registrations', 'settings'];
  const manifest: Record<string, any> = {
    targetProject: TARGET_PROJECT,
    backupTimestamp: new Date().toISOString(),
    backupDirectory: backupDir,
    authUsersCount: authUsers.length,
    collections: {}
  };

  for (const colName of collectionsToBackup) {
    const snap = await db.collection(colName).get();
    const docs = snap.docs.map(d => ({
      _id: d.id,
      _path: d.ref.path,
      ...d.data()
    }));
    fs.writeFileSync(path.join(backupDir, `firestore_${colName}.json`), JSON.stringify(docs, null, 2), 'utf8');
    manifest.collections[colName] = {
      count: docs.length,
      docIds: docs.map(d => d._id)
    };
    console.log(`[Backup] Preserved ${docs.length} documents from collection '${colName}'.`);
  }

  fs.writeFileSync(path.join(backupDir, 'audit_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n=== BACKUP COMPLETED SUCCESSFULLY ===`);
  console.log(`Manifest: ${path.join(backupDir, 'audit_manifest.json')}`);
}

performBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
