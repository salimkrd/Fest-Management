import { loadEnvConfig } from '@next/env';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  documentId,
  getFirestore,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { calculateGrade, getChampionshipPoints } from '@/domain/scoring';
import { getAdminDb } from '@/lib/firebase/admin';

loadEnvConfig(process.cwd());

const projectId = 'demo-sahithyolsav-2025';
const runId = process.env.FEST_SIM_RESUME_ID;
const baseUrl = 'http://127.0.0.1:3000';
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key';

process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(runId, 'Set FEST_SIM_RESUME_ID to the exact simulation run ID.');
  assert((await fetch('http://127.0.0.1:4400/emulators')).ok, 'Firebase Emulator Hub is unavailable.');
  assert((await fetch(baseUrl)).ok, 'Next.js development server is unavailable.');

  const db = getAdminDb();
  assert(db, 'Firebase Admin SDK did not connect to the Firestore Emulator.');
  const competitionsSnapshot = await db.collection('competitions').get();
  const competitions = competitionsSnapshot.docs.filter(doc => doc.id.startsWith(`${runId}-`));
  assert(competitions.length === 100, `Expected 100 simulation competitions, found ${competitions.length}.`);
  const categoryIds = new Set(competitions.map(doc => doc.data().categoryId));
  const groupCompetitions = competitions.filter(doc => doc.data().type === 'GROUP').length;
  const soloCompetitions = competitions.filter(doc => doc.data().type === 'SOLO').length;
  assert(categoryIds.size === 3, `Expected 3 simulation categories, found ${categoryIds.size}.`);
  assert(groupCompetitions === 25 && soloCompetitions === 75, 'Competition type distribution is incorrect.');
  const resultSnapshots = await db.getAll(...competitions.map(doc => db.collection('results').doc(`res-${doc.id}`)));
  assert(resultSnapshots.every(snapshot => snapshot.exists), 'A simulation result document is missing.');

  const pendingResults = resultSnapshots.filter(snapshot =>
    ['READY_TO_PUBLISH', 'READY_FOR_REVIEW'].includes(snapshot.data()?.resultStatus)
  );
  assert(resultSnapshots.every(snapshot =>
    ['READY_TO_PUBLISH', 'READY_FOR_REVIEW', 'PUBLISHED'].includes(snapshot.data()?.resultStatus)
  ), 'A simulation result is in an unexpected state.');

  const teamIdSet = new Set<string>();
  const judgeCounts = new Map<string, number>();
  let registrationCount = 0;
  let assignmentCount = 0;
  let markCount = 0;
  const competitionIds = competitions.map(doc => doc.id);
  for (let index = 0; index < competitionIds.length; index += 30) {
    const ids = competitionIds.slice(index, index + 30);
    const [registrations, assignments, marks] = await Promise.all([
      db.collection('registrations').where('competitionId', 'in', ids).get(),
      db.collection('judgeAssignments').where('competitionId', 'in', ids).get(),
      db.collection('markEntries').where('competitionId', 'in', ids).get()
    ]);
    registrationCount += registrations.size;
    assignmentCount += assignments.size;
    markCount += marks.size;
    registrations.docs.forEach(doc => {
      const teamId = doc.data().teamId;
      if (typeof teamId === 'string') teamIdSet.add(teamId);
    });
    assignments.docs.forEach(doc => {
      const judgeName = doc.data().judgeName;
      if (typeof judgeName === 'string') judgeCounts.set(judgeName, (judgeCounts.get(judgeName) || 0) + 1);
    });
  }
  const teamIds = [...teamIdSet];
  assert(teamIds.length === 4, `Expected 4 simulation teams, found ${teamIds.length}.`);
  assert(registrationCount === 400, `Expected 400 registrations, found ${registrationCount}.`);
  assert(assignmentCount === 100 && markCount === 100,
    `Expected 100 assignments and marks, found ${assignmentCount} and ${markCount}.`);
  assert(judgeCounts.size === 10 && [...judgeCounts.values()].every(count => count === 10),
    'Expected 10 judges with 10 competitions each.');
  const participants = await db.collection('participants').where('teamId', 'in', teamIds).get();
  assert(participants.size === 40, `Expected 40 participants, found ${participants.size}.`);
  assert(new Set(participants.docs.map(doc => doc.data().bib)).size === 40,
    'Participant chest numbers are not unique.');

  const adminApp = initializeApp({ apiKey, authDomain: `${projectId}.firebaseapp.com`, projectId }, `resume-admin-${runId}`);
  const auth = getAuth(adminApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const email = process.env.FEST_SIM_ADMIN_EMAIL || 'admin@sahithyolsav.com';
  const password = process.env.FEST_SIM_ADMIN_PASSWORD;
  assert(password, 'Set FEST_SIM_ADMIN_PASSWORD for the local Auth Emulator.');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const token = await credential.user.getIdToken();

  const observerApps = ['browser-a', 'browser-b'].map(name =>
    initializeApp({ apiKey, authDomain: `${projectId}.firebaseapp.com`, projectId }, `${name}-resume-${runId}`)
  );
  const observers = observerApps.map(app => {
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    let resultCount = 0;
    let leaderboardTotals: Record<string, unknown> = {};
    let teamTotals: Record<string, unknown> = {};
    const initialEvents = new Set<string>();
    let rejectInitial!: (error: Error) => void;
    let resolveInitial!: () => void;
    const initial = new Promise<void>((resolve, reject) => {
      resolveInitial = resolve;
      rejectInitial = reject;
    });
    const ready = (name: string) => {
      initialEvents.add(name);
      if (initialEvents.size === 3) resolveInitial();
    };
    const listenerError = (error: Error) => rejectInitial(new Error(`Realtime observer failed: ${error.message}`));
    const unsubscribers = [
      onSnapshot(query(collection(firestore, 'results'), where('resultStatus', '==', 'PUBLISHED')), snapshot => {
        resultCount = snapshot.size;
        ready('results');
      }, listenerError),
      onSnapshot(collection(firestore, 'leaderboard'), snapshot => {
        leaderboardTotals = Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data().totalPoints]));
        ready('leaderboard');
      }, listenerError),
      onSnapshot(query(collection(firestore, 'teams'), where(documentId(), 'in', teamIds)), snapshot => {
        teamTotals = Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data().totalPoints]));
        ready('teams');
      }, listenerError)
    ];
    return {
      initial,
      get resultCount() { return resultCount; },
      get leaderboardTotals() { return leaderboardTotals; },
      get teamTotals() { return teamTotals; },
      unsubscribers
    };
  });

  try {
    await Promise.all(observers.map(observer => observer.initial));
    const baselineCounts = observers.map(observer => observer.resultCount);
    if (pendingResults.length > 0) {
      const response = await fetch(`${baseUrl}/api/admin/results/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resultIds: pendingResults.map(snapshot => snapshot.id) })
      });
      const outcome = await response.json();
      assert(response.ok, `Bulk publication failed (${response.status}): ${outcome.error || 'no detail'}`);
      assert(
        outcome.resultsPublished === pendingResults.length &&
        outcome.entriesCommitted === pendingResults.reduce((total, snapshot) => total + snapshot.data()!.ranks.length, 0),
        'Bulk publication returned unexpected result or ledger counts.'
      );
    }

    const deadline = Date.now() + 60000;
    while (Date.now() < deadline && observers.some((observer, index) =>
      observer.resultCount < baselineCounts[index] + pendingResults.length
    )) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(observers.every((observer, index) =>
      observer.resultCount >= baselineCounts[index] + pendingResults.length
    ), 'Both result listeners did not receive the published results.');

    const refreshedResults = await db.getAll(...resultSnapshots.map(snapshot => snapshot.ref));
    assert(refreshedResults.every(snapshot => snapshot.data()?.resultStatus === 'PUBLISHED'),
      'Not all 100 simulation results reached PUBLISHED state.');
    const competitionTypes = new Map(competitions.map(doc => [doc.id, doc.data().type]));
    refreshedResults.forEach(snapshot => {
      const result = snapshot.data()!;
      const type = competitionTypes.get(result.competitionId);
      assert(type === 'SOLO' || type === 'GROUP', `Competition type is missing for ${snapshot.id}.`);
      assert(Array.isArray(result.ranks) && result.ranks.length === 4, `Result ranks are incomplete for ${snapshot.id}.`);
      result.ranks.forEach((rank: {
        score: number;
        rank: 1 | 2 | 3 | null;
        grade: string;
        officialPoints: number;
      }) => {
        const grade = calculateGrade(rank.score, 100);
        const points = getChampionshipPoints(type, grade, rank.rank);
        assert(rank.grade === grade && rank.officialPoints === points,
          `Grade or points are incorrect in result ${snapshot.id}.`);
      });
    });

    const ledgerEntries = [];
    for (let index = 0; index < refreshedResults.length; index += 30) {
      const resultIds = refreshedResults.slice(index, index + 30).map(snapshot => snapshot.id);
      const entries = await db.collection('pointsLedger').where('resultId', 'in', resultIds).get();
      ledgerEntries.push(...entries.docs.filter(doc => doc.data().status === 'COMMITTED'));
    }
    assert(ledgerEntries.length === 400, `Expected 400 committed ledger entries, found ${ledgerEntries.length}.`);

    const expectedTotals = new Map<string, number>();
    ledgerEntries.forEach(entry => {
      const { teamId, points } = entry.data();
      expectedTotals.set(teamId, (expectedTotals.get(teamId) || 0) + points);
    });
    const [teamSnapshots, leaderboardSnapshots] = await Promise.all([
      Promise.all(teamIds.map(id => db.collection('teams').doc(id).get())),
      Promise.all(teamIds.map(id => db.collection('leaderboard').doc(id).get()))
    ]);
    teamSnapshots.forEach((snapshot, index) => {
      const expected = expectedTotals.get(snapshot.id) || 0;
      assert(snapshot.data()?.totalPoints === expected, `Team standings are stale for ${snapshot.id}.`);
      assert(leaderboardSnapshots[index].data()?.totalPoints === expected, `Leaderboard is stale for ${snapshot.id}.`);
    });
    const standingsDeadline = Date.now() + 60000;
    const listenersConverged = () => observers.every(observer =>
      teamIds.every(teamId => {
        const expected = expectedTotals.get(teamId) || 0;
        return observer.teamTotals[teamId] === expected && observer.leaderboardTotals[teamId] === expected;
      })
    );
    while (Date.now() < standingsDeadline && !listenersConverged()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(listenersConverged(), 'Live team or leaderboard listeners did not converge in both browsers.');
    console.log(JSON.stringify({
      runId,
      categories: categoryIds.size,
      teams: teamIds.length,
      participants: participants.size,
      competitions: competitions.length,
      soloCompetitions,
      groupCompetitions,
      registrations: registrationCount,
      judges: judgeCounts.size,
      judgeAssignments: assignmentCount,
      submittedScorecards: markCount,
      alreadyPublished: resultSnapshots.length - pendingResults.length,
      newlyPublished: pendingResults.length,
      committedLedgerEntries: ledgerEntries.length,
      synchronizedTeams: teamIds.length,
      liveBrowsersConverged: observers.length
    }, null, 2));
  } finally {
    observers.forEach(observer => observer.unsubscribers.forEach(unsubscribe => unsubscribe()));
    await signOut(auth);
    await Promise.all(observerApps.map(deleteApp));
    await deleteApp(adminApp);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
