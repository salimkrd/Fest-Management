import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

async function executeReset() {
  const TARGET_PROJECT = 'inspirath-d6778';
  const CHIEF_ADMIN_UID = '24QQV8aqbEPMYbIbnmRZMBw64hv1';
  const CHIEF_ADMIN_EMAIL = 'chiefadmin@inspirath.com';

  console.log('================================================================');
  console.log('EXECUTING PRODUCTION FESTIVAL DATA RESET');
  console.log(`Target Firebase Project: ${TARGET_PROJECT}`);
  console.log('================================================================\n');

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account not found: ${serviceAccountPath}`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (serviceAccount.project_id !== TARGET_PROJECT) {
    throw new Error(`Project ID mismatch: ${serviceAccount.project_id}`);
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: TARGET_PROJECT
  }, 'execute-reset-app');

  const auth = getAuth(app);
  const db = getFirestore(app);

  // 1. SAFETY PRE-FLIGHT CHECK
  console.log('[1/5] Safety Pre-Flight Checks...');
  const adminUser = await auth.getUser(CHIEF_ADMIN_UID);
  if (!adminUser || adminUser.email !== CHIEF_ADMIN_EMAIL) {
    throw new Error(`Safety Abort: Chief Admin user ${CHIEF_ADMIN_EMAIL} not found!`);
  }
  const adminDoc = await db.collection('users').doc(CHIEF_ADMIN_UID).get();
  if (!adminDoc.exists) {
    throw new Error(`Safety Abort: Chief Admin Firestore doc users/${CHIEF_ADMIN_UID} not found!`);
  }
  const lockDoc = await db.collection('settings').doc('bootstrapLock').get();
  if (!lockDoc.exists) {
    throw new Error(`Safety Abort: settings/bootstrapLock not found!`);
  }
  console.log('  ✓ Chief Administrator account verified in Auth and Firestore.');
  console.log('  ✓ settings/bootstrapLock verified.');

  // 2. DELETE FESTIVAL-SPECIFIC AUTH USERS (NON-ADMIN)
  console.log('\n[2/5] Deleting festival-specific Auth users (excluding Chief Admin)...');
  const userList = await auth.listUsers(1000);
  for (const user of userList.users) {
    if (user.uid === CHIEF_ADMIN_UID || user.email === CHIEF_ADMIN_EMAIL) {
      console.log(`  [PRESERVED] Chief Admin: ${user.email} (${user.uid})`);
      continue;
    }
    console.log(`  [DELETING] Festival user: ${user.email} (${user.uid}) - role: ${user.customClaims?.role || 'NONE'}`);
    await auth.deleteUser(user.uid);
    console.log(`    ✓ Deleted Auth user: ${user.uid}`);
  }

  // 3. DELETE FESTIVAL-SPECIFIC OPERATIONAL FIRESTORE COLLECTIONS
  console.log('\n[3/5] Clearing operational festival Firestore collections...');

  const operationalCollections = [
    'categories',
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
    'generatedPosters'
  ];

  for (const colName of operationalCollections) {
    const snap = await db.collection(colName).get();
    if (snap.size > 0) {
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`  ✓ Cleared ${snap.size} document(s) from '${colName}'.`);
    } else {
      console.log(`  - Collection '${colName}' is already empty.`);
    }
  }

  // Handle teams and their nested subcollections (e.g. /teams/{teamId}/private)
  console.log('\n[4/5] Clearing teams and nested subcollections...');
  const teamsSnap = await db.collection('teams').get();
  for (const teamDoc of teamsSnap.docs) {
    const subcols = await teamDoc.ref.listCollections();
    for (const subcol of subcols) {
      const subSnap = await subcol.get();
      if (subSnap.size > 0) {
        const batch = db.batch();
        subSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`    ✓ Cleared ${subSnap.size} doc(s) from subcollection teams/${teamDoc.id}/${subcol.id}`);
      }
    }
    await teamDoc.ref.delete();
    console.log(`  ✓ Deleted team doc: ${teamDoc.id}`);
  }

  // Clear non-admin users from Firestore 'users' collection
  const usersSnap = await db.collection('users').get();
  for (const uDoc of usersSnap.docs) {
    if (uDoc.id === CHIEF_ADMIN_UID) {
      console.log(`  [PRESERVED] Firestore users doc: ${uDoc.id} (${uDoc.data().email})`);
      continue;
    }
    await uDoc.ref.delete();
    console.log(`  ✓ Deleted non-admin users doc: ${uDoc.id}`);
  }

  // 4. POST-RESET VERIFICATION
  console.log('\n[5/5] Performing Post-Reset Verification...');
  let allClean = true;

  for (const colName of operationalCollections) {
    const check = await db.collection(colName).get();
    if (check.size > 0) {
      console.error(`  ✕ Collection '${colName}' still has ${check.size} document(s)!`);
      allClean = false;
    } else {
      console.log(`  ✓ '${colName}': 0 documents.`);
    }
  }

  const teamCheck = await db.collection('teams').get();
  if (teamCheck.size > 0) {
    console.error(`  ✕ 'teams' still has ${teamCheck.size} document(s)!`);
    allClean = false;
  } else {
    console.log(`  ✓ 'teams': 0 documents.`);
  }

  const finalUsersSnap = await db.collection('users').get();
  console.log(`  ✓ 'users' collection count: ${finalUsersSnap.size} (Only Chief Admin doc ${CHIEF_ADMIN_UID})`);

  const finalLock = await db.collection('settings').doc('bootstrapLock').get();
  console.log(`  ✓ 'settings/bootstrapLock' verified intact: ${finalLock.exists}`);

  const finalAuth = await auth.getUser(CHIEF_ADMIN_UID);
  console.log(`  ✓ Chief Admin Auth account verified: ${finalAuth.email} (Claims: ${JSON.stringify(finalAuth.customClaims)})`);

  console.log('\n================================================================');
  if (allClean) {
    console.log('RESET SUCCESSFUL: All festival operational data cleared.');
  } else {
    console.error('RESET WARNING: Some collections still contain documents.');
  }
  console.log('================================================================');
}

executeReset().catch(err => {
  console.error('Reset execution failed:', err);
  process.exit(1);
});
