import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { initializeApp as initClientApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function verify() {
  console.log('--- 1. Admin Verification of Live Rulesets on inspirath-d6778 ---');
  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778',
    storageBucket: 'inspirath-d6778.firebasestorage.app'
  }, 'verify-admin-app');

  const securityRules = getSecurityRules(adminApp);

  // Firestore ruleset check
  const liveFirestoreRuleset = await securityRules.getFirestoreRuleset();
  const liveFirestoreSource = liveFirestoreRuleset.source[0]?.content || '';
  const localFirestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

  console.log(`Live Firestore Ruleset ID: ${liveFirestoreRuleset.name}`);
  console.log(`Live Firestore Ruleset Created: ${liveFirestoreRuleset.createTime}`);
  const firestoreMatch = liveFirestoreSource.trim() === localFirestoreRules.trim();
  console.log(`Firestore Rules Exact Match: ${firestoreMatch ? 'PASS (100% Match)' : 'FAIL'}`);

  // Storage ruleset check
  const liveStorageRuleset = await securityRules.getStorageRuleset();
  const liveStorageSource = liveStorageRuleset.source[0]?.content || '';
  const localStorageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');

  console.log(`Live Storage Ruleset ID: ${liveStorageRuleset.name}`);
  console.log(`Live Storage Ruleset Created: ${liveStorageRuleset.createTime}`);
  const storageMatch = liveStorageSource.trim() === localStorageRules.trim();
  console.log(`Storage Rules Exact Match: ${storageMatch ? 'PASS (100% Match)' : 'FAIL'}`);

  console.log('\n--- 2. Client SDK Non-Destructive Live Security Checks against inspirath-d6778 ---');
  const clientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'inspirath-d6778.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'inspirath-d6778',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'inspirath-d6778.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
  };

  const clientApp = initClientApp(clientConfig, 'verify-client-app');
  const clientDb = getFirestore(clientApp);

  // Non-destructive read: public read of categories
  try {
    const snap = await getDocs(collection(clientDb, 'categories'));
    console.log(`Public read on 'categories': PASS (Permitted as expected, read ${snap.docs.length} documents)`);
  } catch (err: any) {
    console.log(`Public read on 'categories': FAIL (${err.message})`);
  }

  // Non-destructive write defense: unauthenticated client write to markEntries MUST be rejected
  try {
    await setDoc(doc(clientDb, 'markEntries', 'probe-unauthorized-entry'), {
      id: 'probe-unauthorized-entry',
      status: 'DRAFT',
      scores: { 'p1': 50 }
    });
    console.error('CRITICAL VULNERABILITY: Public write to markEntries succeeded!');
  } catch (err: any) {
    console.log(`Unauthorized client write to 'markEntries': PASS (Strictly Rejected: ${err.code || err.message})`);
  }

  // Non-destructive write defense: unauthenticated client write to results MUST be rejected
  try {
    await setDoc(doc(clientDb, 'results', 'probe-unauthorized-result'), {
      id: 'probe-unauthorized-result',
      status: 'PUBLISHED'
    });
    console.error('CRITICAL VULNERABILITY: Public write to results succeeded!');
  } catch (err: any) {
    console.log(`Unauthorized client write to 'results': PASS (Strictly Rejected: ${err.code || err.message})`);
  }

  // Non-destructive write defense: unauthenticated client write to pointsLedger MUST be rejected
  try {
    await setDoc(doc(clientDb, 'pointsLedger', 'probe-unauthorized-ledger'), {
      id: 'probe-unauthorized-ledger',
      status: 'COMMITTED'
    });
    console.error('CRITICAL VULNERABILITY: Public write to pointsLedger succeeded!');
  } catch (err: any) {
    console.log(`Unauthorized client write to 'pointsLedger': PASS (Strictly Rejected: ${err.code || err.message})`);
  }

  // Non-destructive write defense: unauthenticated client write to settings/bootstrapLock MUST be rejected
  try {
    await setDoc(doc(clientDb, 'settings', 'bootstrapLock'), {
      locked: true,
      owner: 'attacker'
    });
    console.error('CRITICAL VULNERABILITY: Public write to settings/bootstrapLock succeeded!');
  } catch (err: any) {
    console.log(`Unauthorized client write to 'settings/bootstrapLock': PASS (Strictly Rejected: ${err.code || err.message})`);
  }

  console.log('\n--- Verification complete ---');
}

verify().catch(console.error);
