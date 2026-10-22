import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';
import * as fs from 'fs';
import * as path from 'path';

async function check() {
  console.log('=== PRE-ACTIVATION VERIFICATION FOR CHECKPOINT 2 ===\n');

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('FAIL: Service account credentials not found at:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log(`1. Target Project ID: ${serviceAccount.project_id} (Expected: inspirath-d6778)`);
  if (serviceAccount.project_id !== 'inspirath-d6778') {
    console.error('FAIL: Service account project_id does not match inspirath-d6778');
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778',
    storageBucket: 'inspirath-d6778.firebasestorage.app'
  }, 'pre-activation-check');

  const auth = getAuth(app);
  const db = getFirestore(app);
  const securityRules = getSecurityRules(app);

  // 2. Security Rules Verification
  console.log('\n2. Verifying Deployed Security Rules...');
  const fsRuleset = await securityRules.getFirestoreRuleset();
  console.log(`- Live Firestore Ruleset Name: ${fsRuleset.name}`);
  const stRuleset = await securityRules.getStorageRuleset();
  console.log(`- Live Storage Ruleset Name: ${stRuleset.name}`);

  // 3. Auth Configuration & User Count
  console.log('\n3. Verifying Firebase Authentication & Existing Users...');
  try {
    const listResult = await auth.listUsers(10);
    console.log(`- Firebase Auth operational. Current user count: ${listResult.users.length}`);
    if (listResult.users.length > 0) {
      console.log('  Existing users:', listResult.users.map(u => ({ uid: u.uid, email: u.email, claims: u.customClaims })));
    } else {
      console.log('  Zero users exist in production Auth (Ready for initial administrator bootstrap).');
    }
  } catch (err: any) {
    console.error('FAIL: Error connecting to Firebase Auth:', err.message);
    process.exit(1);
  }

  // 4. Firestore Existing Admin & Bootstrap Lock
  console.log('\n4. Verifying Firestore users and bootstrapLock state...');
  const adminUsersSnap = await db.collection('users').where('role', '==', 'ADMIN').get();
  console.log(`- Existing ADMIN users in Firestore: ${adminUsersSnap.docs.length}`);

  const lockSnap = await db.collection('settings').doc('bootstrapLock').get();
  if (lockSnap.exists) {
    console.log('- bootstrapLock exists:', lockSnap.data());
  } else {
    console.log('- bootstrapLock: Not yet initialized (Ready for first-time atomic acquisition).');
  }

  console.log('\n=== PRE-ACTIVATION VERIFICATION COMPLETE ===');
}

check().catch(console.error);
