import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

async function investigate() {
  console.log('=== PRODUCTION STATE INVESTIGATION: inspirath-d6778 ===\n');

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account not found:', serviceAccountPath);
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778'
  }, 'investigate-app');

  const auth = getAuth(app);
  const db = getFirestore(app);

  // 1. INVESTIGATE FIREBASE AUTH USERS
  console.log('1. Checking ALL Firebase Auth Users...');
  const userRecords: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    userRecords.push(...listResult.users);
    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log(`Total Auth Users Found: ${userRecords.length}`);
  userRecords.forEach((u, i) => {
    console.log(`[Auth User ${i + 1}]`);
    console.log(`  UID: ${u.uid}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  DisplayName: ${u.displayName}`);
    console.log(`  Disabled: ${u.disabled}`);
    console.log(`  Custom Claims: ${JSON.stringify(u.customClaims)}`);
    console.log(`  Created: ${u.metadata.creationTime}`);
    console.log(`  Last Sign-In: ${u.metadata.lastSignInTime}`);
  });

  // 2. INVESTIGATE FIRESTORE `users` COLLECTION
  console.log('\n2. Checking Firestore `users` Collection...');
  const usersSnap = await db.collection('users').get();
  console.log(`Total Firestore User Documents Found: ${usersSnap.docs.length}`);
  usersSnap.docs.forEach((doc, i) => {
    console.log(`[Firestore User ${i + 1}] ID: ${doc.id}`);
    console.log(`  Data:`, JSON.stringify(doc.data(), null, 2));
  });

  // 3. INVESTIGATE FIRESTORE `settings/bootstrapLock`
  console.log('\n3. Checking Firestore `settings/bootstrapLock` Document...');
  const lockDoc = await db.collection('settings').doc('bootstrapLock').get();
  if (lockDoc.exists) {
    console.log('bootstrapLock exists: TRUE');
    console.log('Data:', JSON.stringify(lockDoc.data(), null, 2));
  } else {
    console.log('bootstrapLock exists: FALSE (Document does not exist)');
  }

  // 4. CHECK OTHER `settings` DOCUMENTS
  console.log('\n4. Checking all documents in `settings` collection...');
  const settingsSnap = await db.collection('settings').get();
  console.log(`Total Settings Documents Found: ${settingsSnap.docs.length}`);
  settingsSnap.docs.forEach(doc => {
    console.log(`  Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
  });

  // 5. CHECK OTHER ROOT COLLECTIONS IN FIRESTORE
  console.log('\n5. Checking all root collections in Firestore...');
  const collections = await db.listCollections();
  console.log(`Collections present: ${collections.map(c => c.id).join(', ') || 'NONE'}`);
  for (const col of collections) {
    const snap = await col.limit(5).get();
    console.log(`  - Collection '${col.id}': ${snap.size} sample document(s)`);
    snap.docs.forEach(d => {
      console.log(`    Doc ID: ${d.id}`);
    });
  }

  console.log('\n=== INVESTIGATION COMPLETED ===');
}

investigate().catch(console.error);
