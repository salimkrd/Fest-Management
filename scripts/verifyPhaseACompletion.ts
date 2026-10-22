import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

async function verifyState() {
  const TARGET_PROJECT = 'inspirath-d6778';
  console.log(`=== POST-RECOVERY PRODUCTION VERIFICATION: ${TARGET_PROJECT} ===\n`);

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: TARGET_PROJECT
  }, `verify-app-${Date.now()}`);

  const auth = getAuth(app);
  const db = getFirestore(app);

  // 1. Verify Auth Users
  const authUsers: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    authUsers.push(...listResult.users);
    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log(`1. Firebase Authentication Users Remaining: ${authUsers.length}`);
  if (authUsers.length === 0) {
    console.log('   PASS: ZERO unintended Firebase Authentication users remain.');
  } else {
    console.error(`   FAIL: Unexpected users found: ${authUsers.map(u => u.email).join(', ')}`);
  }

  // 2. Verify imposter cannot authenticate / is deleted
  try {
    await auth.getUser('LFSyKBUeojNO8ds9saw6NvHMMFz2');
    console.error('   FAIL: imposter UID still exists in Auth!');
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      console.log('   PASS: Confirmed imposter UID is completely deleted from Auth.');
    } else {
      console.error('   Error checking imposter UID:', err);
    }
  }

  // 3. Verify Firestore Collections
  const collections = await db.listCollections();
  console.log(`\n2. Firestore Collections Present: ${collections.map(c => c.id).join(', ') || 'NONE'}`);

  let totalDocsRemaining = 0;
  for (const col of collections) {
    const snap = await col.get();
    totalDocsRemaining += snap.size;
    console.log(`   - Collection '${col.id}': ${snap.size} documents remaining`);
    snap.docs.forEach(d => {
      console.log(`     Doc ID: ${d.id}`);
    });
  }

  console.log(`\n3. Total Firestore Documents Remaining: ${totalDocsRemaining}`);

  // 4. Verify settings/bootstrapLock
  const lockDoc = await db.collection('settings').doc('bootstrapLock').get();
  console.log(`\n4. settings/bootstrapLock exists: ${lockDoc.exists}`);
  if (!lockDoc.exists) {
    console.log('   PASS: bootstrapLock is absent, ready for authorized bootstrap in Phase B.');
  } else {
    console.error('   FAIL: bootstrapLock exists!');
  }

  // 5. Verify users collection
  const usersSnap = await db.collection('users').get();
  console.log(`\n5. Firestore 'users' collection document count: ${usersSnap.size}`);
  if (usersSnap.size === 0) {
    console.log('   PASS: ZERO unauthorized Firestore ADMIN documents remain.');
  } else {
    console.error(`   FAIL: Users still present in Firestore: ${usersSnap.docs.map(d => d.id).join(', ')}`);
  }
}

verifyState().catch(console.error);
