import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// STRICT SAFETY MANIFEST: Explicit exact IDs only. No wildcards. No collection-wide queries.
export const TARGET_DOCUMENTS = {
  authUsers: [
    { uid: 'LFSyKBUeojNO8ds9saw6NvHMMFz2', email: 'imposter@sahithyolsav.com' }
  ],
  users: [
    'LFSyKBUeojNO8ds9saw6NvHMMFz2'
  ],
  competitions: [
    'comp-dupe-test',
    'comp-ineligible-test',
    'comp-pending-only',
    'comp-rubric-strict',
    'comp-zero-registrations'
  ],
  judgeAssignments: [
    'asg-02',
    'asg-expired-demo',
    'asgn-active-test',
    'asgn-dupe-test',
    'asgn-expired-test',
    'asgn-ineligible-test',
    'asgn-missing-exp-test',
    'asgn-pending-only',
    'asgn-revoked-test',
    'asgn-rubric-test',
    'asgn-stale-test',
    'asgn-submit-service-test',
    'asgn-submitted-test',
    'asgn-unreg-test',
    'asgn-zero-reg-test'
  ],
  markEntries: [
    'mark-expired-read-target',
    'mark-immutable-final',
    'mark-revoked-read-target',
    'mark-submitted-read-target',
    'me-asg-02',
    'me-asg-expired',
    'me-asgn-ineligible-test',
    'me-asgn-submit-service-test'
  ],
  registrations: [
    'reg-approved-1',
    'reg-cancelled-status',
    'reg-dupe-1',
    'reg-empty-status',
    'reg-missing-status',
    'reg-null-status',
    'reg-only-pending',
    'reg-pending-status',
    'reg-rubric-01',
    'reg-service-1',
    'reg-service-2',
    'reg-withdrawn-status'
  ]
};

async function main() {
  const isExecute = process.argv.includes('--execute');
  const isDryRun = process.argv.includes('--dry-run') || !isExecute;
  const TARGET_PROJECT = 'inspirath-d6778';

  console.log(`================================================================`);
  console.log(`PHASE A TARGETED PRODUCTION RECOVERY`);
  console.log(`Mode: ${isExecute ? 'EXECUTE (DESTRUCTIVE TARGETED DELETION)' : 'DRY RUN (READ ONLY)'}`);
  console.log(`Target Project: ${TARGET_PROJECT}`);
  console.log(`================================================================\n`);

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account not found: ${serviceAccountPath}`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (serviceAccount.project_id !== TARGET_PROJECT) {
    throw new Error(`Safety violation: Service account project ID '${serviceAccount.project_id}' does not match target '${TARGET_PROJECT}'`);
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: TARGET_PROJECT
  }, `recovery-app-${Date.now()}`);

  const auth = getAuth(app);
  const db = getFirestore(app);

  // 1. SAFETY CHECK: Verify total counts in DB match exactly our expected audit
  console.log('--- SAFETY CHECK 1: Verifying Existing DB Counts ---');
  const allUsersSnap = await db.collection('users').get();
  const allCompSnap = await db.collection('competitions').get();
  const allAsgnSnap = await db.collection('judgeAssignments').get();
  const allMarksSnap = await db.collection('markEntries').get();
  const allRegsSnap = await db.collection('registrations').get();
  const lockSnap = await db.collection('settings').doc('bootstrapLock').get();

  console.log(`Current DB State:`);
  console.log(`  - users: ${allUsersSnap.size} docs`);
  console.log(`  - competitions: ${allCompSnap.size} docs`);
  console.log(`  - judgeAssignments: ${allAsgnSnap.size} docs`);
  console.log(`  - markEntries: ${allMarksSnap.size} docs`);
  console.log(`  - registrations: ${allRegsSnap.size} docs`);
  console.log(`  - settings/bootstrapLock exists: ${lockSnap.exists}`);

  if (allUsersSnap.size !== TARGET_DOCUMENTS.users.length) {
    throw new Error(`Safety Stop: 'users' collection count (${allUsersSnap.size}) differs from target list (${TARGET_DOCUMENTS.users.length}). Aborting to prevent deleting unexpected records!`);
  }
  if (allCompSnap.size !== TARGET_DOCUMENTS.competitions.length) {
    throw new Error(`Safety Stop: 'competitions' collection count (${allCompSnap.size}) differs from target list (${TARGET_DOCUMENTS.competitions.length}). Aborting!`);
  }
  if (allAsgnSnap.size !== TARGET_DOCUMENTS.judgeAssignments.length) {
    throw new Error(`Safety Stop: 'judgeAssignments' collection count (${allAsgnSnap.size}) differs from target list (${TARGET_DOCUMENTS.judgeAssignments.length}). Aborting!`);
  }
  if (allMarksSnap.size !== TARGET_DOCUMENTS.markEntries.length) {
    throw new Error(`Safety Stop: 'markEntries' collection count (${allMarksSnap.size}) differs from target list (${TARGET_DOCUMENTS.markEntries.length}). Aborting!`);
  }
  if (allRegsSnap.size !== TARGET_DOCUMENTS.registrations.length) {
    throw new Error(`Safety Stop: 'registrations' collection count (${allRegsSnap.size}) differs from target list (${TARGET_DOCUMENTS.registrations.length}). Aborting!`);
  }

  // 2. DRY RUN / EXECUTION OF FIREBASE AUTH DELETION
  console.log('\n--- TARGET 1: Firebase Authentication Test Users ---');
  for (const targetAuth of TARGET_DOCUMENTS.authUsers) {
    try {
      const userRec = await auth.getUser(targetAuth.uid);
      console.log(`  [Found] UID: ${userRec.uid} | Email: ${userRec.email} | Claims: ${JSON.stringify(userRec.customClaims)}`);
      if (userRec.email !== targetAuth.email) {
        throw new Error(`Safety Stop: UID ${targetAuth.uid} email mismatch: expected ${targetAuth.email}, got ${userRec.email}`);
      }
      if (isExecute) {
        await auth.deleteUser(targetAuth.uid);
        console.log(`  [DELETED] Auth user UID: ${targetAuth.uid} (${targetAuth.email})`);
      } else {
        console.log(`  [DRY RUN] Would delete Auth user UID: ${targetAuth.uid} (${targetAuth.email})`);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        console.log(`  [Notice] Auth user UID ${targetAuth.uid} already absent.`);
      } else {
        throw err;
      }
    }
  }

  // 3. TARGET: Firestore users
  console.log('\n--- TARGET 2: Firestore `users` Collection ---');
  for (const id of TARGET_DOCUMENTS.users) {
    const docRef = db.collection('users').doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      console.log(`  [Found] Doc 'users/${id}': email=${data?.email}, role=${data?.role}`);
      if (isExecute) {
        await docRef.delete();
        console.log(`  [DELETED] 'users/${id}'`);
      } else {
        console.log(`  [DRY RUN] Would delete 'users/${id}'`);
      }
    } else {
      console.log(`  [Notice] 'users/${id}' already absent.`);
    }
  }

  // 4. TARGET: competitions
  console.log('\n--- TARGET 3: Firestore `competitions` Collection ---');
  for (const id of TARGET_DOCUMENTS.competitions) {
    const docRef = db.collection('competitions').doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      console.log(`  [Found] Doc 'competitions/${id}': name="${data?.name}"`);
      if (isExecute) {
        await docRef.delete();
        console.log(`  [DELETED] 'competitions/${id}'`);
      } else {
        console.log(`  [DRY RUN] Would delete 'competitions/${id}'`);
      }
    } else {
      console.log(`  [Notice] 'competitions/${id}' already absent.`);
    }
  }

  // 5. TARGET: judgeAssignments
  console.log('\n--- TARGET 4: Firestore `judgeAssignments` Collection ---');
  for (const id of TARGET_DOCUMENTS.judgeAssignments) {
    const docRef = db.collection('judgeAssignments').doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      console.log(`  [Found] Doc 'judgeAssignments/${id}': comp=${data?.competitionId}, status=${data?.status}`);
      if (isExecute) {
        await docRef.delete();
        console.log(`  [DELETED] 'judgeAssignments/${id}'`);
      } else {
        console.log(`  [DRY RUN] Would delete 'judgeAssignments/${id}'`);
      }
    } else {
      console.log(`  [Notice] 'judgeAssignments/${id}' already absent.`);
    }
  }

  // 6. TARGET: markEntries
  console.log('\n--- TARGET 5: Firestore `markEntries` Collection ---');
  for (const id of TARGET_DOCUMENTS.markEntries) {
    const docRef = db.collection('markEntries').doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      console.log(`  [Found] Doc 'markEntries/${id}': asgn=${data?.assignmentId}, comp=${data?.competitionId}`);
      if (isExecute) {
        await docRef.delete();
        console.log(`  [DELETED] 'markEntries/${id}'`);
      } else {
        console.log(`  [DRY RUN] Would delete 'markEntries/${id}'`);
      }
    } else {
      console.log(`  [Notice] 'markEntries/${id}' already absent.`);
    }
  }

  // 7. TARGET: registrations
  console.log('\n--- TARGET 6: Firestore `registrations` Collection ---');
  for (const id of TARGET_DOCUMENTS.registrations) {
    const docRef = db.collection('registrations').doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      console.log(`  [Found] Doc 'registrations/${id}': comp=${data?.competitionId}, bib=${data?.bib}, status=${data?.status}`);
      if (isExecute) {
        await docRef.delete();
        console.log(`  [DELETED] 'registrations/${id}'`);
      } else {
        console.log(`  [DRY RUN] Would delete 'registrations/${id}'`);
      }
    } else {
      console.log(`  [Notice] 'registrations/${id}' already absent.`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`PHASE A ${isExecute ? 'EXECUTION COMPLETED' : 'DRY RUN COMPLETED'}`);
  console.log(`================================================================`);
}

main().catch(err => {
  console.error('\n!!! RECOVERY HALTED WITH ERROR !!!', err);
  process.exit(1);
});
