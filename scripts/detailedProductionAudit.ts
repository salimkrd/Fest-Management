import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

async function fullAudit() {
  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account not found:', serviceAccountPath);
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778'
  }, 'audit-app');

  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('=== FULL PRODUCTION AUDIT: inspirath-d6778 ===\n');

  // 1. Auth Users
  const userRecords: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    userRecords.push(...listResult.users);
    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log(`[AUTH] Total Users: ${userRecords.length}`);
  userRecords.forEach(u => {
    console.log(`  UID: ${u.uid} | Email: ${u.email} | Claims: ${JSON.stringify(u.customClaims)} | Created: ${u.metadata.creationTime}`);
  });

  // 2. Collections
  const collections = await db.listCollections();
  console.log(`\n[FIRESTORE] Collections: ${collections.map(c => c.id).join(', ')}`);

  const auditData: Record<string, any[]> = {};

  for (const col of collections) {
    const snap = await col.get();
    console.log(`\n--- Collection: ${col.id} (${snap.size} documents) ---`);
    auditData[col.id] = [];
    snap.docs.forEach(doc => {
      console.log(`  ID: ${doc.id}`);
      auditData[col.id].push({ id: doc.id, data: doc.data() });
    });
  }

  // Check settings/bootstrapLock specifically
  const lock = await db.collection('settings').doc('bootstrapLock').get();
  console.log(`\nsettings/bootstrapLock exists: ${lock.exists}`);

  console.log('\n=== AUDIT SUMMARY ===');
  for (const [colName, docs] of Object.entries(auditData)) {
    console.log(`${colName}: ${docs.length} docs -> [${docs.map(d => d.id).join(', ')}]`);
  }
}

fullAudit().catch(console.error);
