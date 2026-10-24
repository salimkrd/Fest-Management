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
import { getAdminDb } from '@/lib/firebase/admin';
import { calculateGrade, getChampionshipPoints } from '@/domain/scoring';
import type { Category, Competition, Participant, Registration } from '@/types/fest';

loadEnvConfig(process.cwd());

const projectId = 'demo-sahithyolsav-2025';
const baseUrl = 'http://127.0.0.1:3000';
const emulatorHosts = {
  auth: '127.0.0.1:9099',
  firestore: '127.0.0.1:8080'
};

process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = emulatorHosts.firestore;
process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorHosts.auth;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

const runId = `sim-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
const timings: Record<string, number[]> = {};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function api<T>(
  label: string,
  path: string,
  body: Record<string, unknown>,
  token?: string
): Promise<T> {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  timings[label] ||= [];
  timings[label].push(performance.now() - startedAt);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${result.error || 'No error detail returned'}`);
  }
  return result as T;
}

function percentile(values: number[], percentage: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentage))] || 0;
}

async function createObserver(name: string, teamIds: string[]) {
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId
  }, `${name}-${runId}`);
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);

  let resultCount = 0;
  let leaderboard: Record<string, Record<string, unknown>> = {};
  let teams: Record<string, Record<string, unknown>> = {};
  let initialEvents = 0;
  let resolveInitial: (() => void) | undefined;
  let rejectInitial: ((error: Error) => void) | undefined;
  const initialSnapshot = new Promise<void>((resolve, reject) => {
    resolveInitial = resolve;
    rejectInitial = reject;
  });
  const receiveInitial = () => {
    initialEvents += 1;
    if (initialEvents >= 3) resolveInitial?.();
  };

  const unsubscribeResults = onSnapshot(
    query(collection(firestore, 'results'), where('resultStatus', '==', 'PUBLISHED')),
    snapshot => {
      resultCount = snapshot.size;
      receiveInitial();
    },
    error => rejectInitial?.(new Error(`[${name}] Results listener failed: ${error.message}`))
  );
  const unsubscribeLeaderboard = onSnapshot(collection(firestore, 'leaderboard'), snapshot => {
    leaderboard = Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data()]));
    receiveInitial();
  }, error => rejectInitial?.(new Error(`[${name}] Leaderboard listener failed: ${error.message}`)));
  const unsubscribeTeams = onSnapshot(
    query(collection(firestore, 'teams'), where(documentId(), 'in', teamIds)),
    snapshot => {
      teams = Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data()]));
      receiveInitial();
    },
    error => rejectInitial?.(new Error(`[${name}] Team standings listener failed: ${error.message}`))
  );

  const timeout = setTimeout(() => rejectInitial?.(new Error(`${name} realtime listeners timed out.`)), 15000);
  try {
    await initialSnapshot;
  } finally {
    clearTimeout(timeout);
  }

  return {
    app,
    firestore,
    get resultCount() { return resultCount; },
    get leaderboard() { return leaderboard; },
    get teams() { return teams; },
    unsubscribe() {
      unsubscribeResults();
      unsubscribeLeaderboard();
      unsubscribeTeams();
    }
  };
}

async function waitFor(predicate: () => boolean, message: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function main() {
  assert(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === projectId, 'Simulation must use the demo Firebase project.');
  const emulatorStatus = await fetch('http://127.0.0.1:4400/emulators');
  assert(emulatorStatus.ok, 'Firebase Emulator Hub is not responding on 127.0.0.1:4400.');
  const appResponse = await fetch(baseUrl);
  assert(appResponse.ok, 'Next.js development server is not responding on 127.0.0.1:3000.');

  const adminDb = getAdminDb();
  assert(adminDb, 'Firebase Admin SDK did not connect to the Firestore Emulator.');

  const clientApp = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId
  }, `fest-simulation-admin-${runId}`);
  const clientAuth = getAuth(clientApp);
  connectAuthEmulator(clientAuth, `http://${emulatorHosts.auth}`, { disableWarnings: true });

  const adminEmail = process.env.FEST_SIM_ADMIN_EMAIL || 'admin@sahithyolsav.com';
  const adminPassword = process.env.FEST_SIM_ADMIN_PASSWORD;
  assert(adminPassword, 'Set FEST_SIM_ADMIN_PASSWORD to an administrator password for the local Auth Emulator.');

  const observers: Awaited<ReturnType<typeof createObserver>>[] = [];
  try {
    const adminCredential = await signInWithEmailAndPassword(clientAuth, adminEmail, adminPassword);
    const adminToken = await adminCredential.user.getIdToken();
    const categories: Category[] = [
      { id: `${runId}-cat-sj`, name: 'Simulation Sub Junior', code: `${runId}-SJ`, eligibility: 'Test category', ageRange: '10-12', classRange: '5-7', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
      { id: `${runId}-cat-jr`, name: 'Simulation Junior', code: `${runId}-JR`, eligibility: 'Test category', ageRange: '13-15', classRange: '8-10', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
      { id: `${runId}-cat-sr`, name: 'Simulation Senior', code: `${runId}-SR`, eligibility: 'Test category', ageRange: '16-18', classRange: '11-12', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
    ];
    await Promise.all(categories.map(category =>
      adminDb.collection('categories').doc(category.id).set(category)
    ));

    const teams: Array<{ id: string; code: string; name: string; token: string; participants: Participant[] }> = [];
    for (let teamIndex = 0; teamIndex < 4; teamIndex += 1) {
      const managerEmail = `${runId}-manager-${teamIndex + 1}@example.test`;
      const managerPassword = `FestSim-${runId}-${teamIndex + 1}!`;
      const teamCode = `F${runId.slice(-4).toUpperCase()}${teamIndex + 1}`;
      const creation = await api<{
        team: { id: string; name: string; code: string };
        invitation: { code: string };
      }>('teamCreate', '/api/admin/teams', {
        name: `${runId} Contingent ${teamIndex + 1}`,
        code: teamCode,
        managerEmail,
        managerName: `${runId} Manager ${teamIndex + 1}`,
        managerPhone: `+91990000000${teamIndex + 1}`
      }, adminToken);

      await api('managerActivation', '/api/team/activate', {
        code: creation.invitation.code,
        email: managerEmail,
        newPassword: managerPassword,
        teamId: creation.team.id
      });
      await signOut(clientAuth);
      const managerCredential = await signInWithEmailAndPassword(clientAuth, managerEmail, managerPassword);
      const managerToken = await managerCredential.user.getIdToken();
      const participants: Participant[] = [];
      const categoryDistribution = [4, 3, 3];
      for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
        for (let memberIndex = 0; memberIndex < categoryDistribution[categoryIndex]; memberIndex += 1) {
          const response = await api<{ participant: Participant }>(
            'participantCreate',
            `/api/team/${encodeURIComponent(creation.team.id)}/participants`,
            {
              name: `${runId} Team ${teamIndex + 1} Participant ${participants.length + 1}`,
              email: `${runId}-t${teamIndex + 1}-p${participants.length + 1}@example.test`,
              phone: `+919800000${teamIndex + 1}${String(participants.length + 1).padStart(2, '0')}`,
              categoryId: categories[categoryIndex].id,
              classGrade: `Std ${5 + categoryIndex * 3}`,
              division: 'A',
              dob: '2010-01-01',
              photoUrl: '',
              registeredEventIds: []
            },
            managerToken
          );
          participants.push(response.participant);
        }
      }
      assert(participants.length === 10, `${creation.team.code} does not have exactly 10 participants.`);
      assert(categories.every((category, categoryIndex) =>
        participants.filter(participant => participant.categoryId === category.id).length === categoryDistribution[categoryIndex]
      ), `${creation.team.code} participant categories do not match the 4/3/3 distribution.`);
      teams.push({
        id: creation.team.id,
        code: creation.team.code,
        name: creation.team.name,
        token: managerToken,
        participants
      });
    }
    await signOut(clientAuth);

    const competitions: Competition[] = Array.from({ length: 100 }, (_, index) => {
      const category = categories[index % categories.length];
      return {
        id: `${runId}-cmp-${String(index + 1).padStart(3, '0')}`,
        code: `SIM-${String(index + 1).padStart(3, '0')}`,
        name: `${runId} Competition ${index + 1}`,
        categoryId: category.id,
        categoryName: category.name,
        type: index % 4 === 0 ? 'GROUP' : 'SOLO',
        entriesCount: 0,
        stageId: `${runId}-stage`,
        stageName: `${runId} Main Stage`,
        assignedJudges: [],
        status: 'SCHEDULED',
        date: '2026-10-23',
        timeSlot: '10:00 AM - 11:00 AM',
        durationMinutes: 60,
        maxEntriesPerTeam: 1,
        criteria: [
          { id: 'criterion-1', name: 'Accuracy', maxMarks: 40 },
          { id: 'criterion-2', name: 'Delivery', maxMarks: 30 },
          { id: 'criterion-3', name: 'Overall', maxMarks: 30 }
        ]
      };
    });
    const competitionBatch = adminDb.batch();
    competitions.forEach(competition => {
      competitionBatch.set(adminDb.collection('competitions').doc(competition.id), competition);
    });
    await competitionBatch.commit();

    const registrationsByCompetition: Registration[][] = [];
    const registrationCodes = new Set<string>();
    for (let competitionIndex = 0; competitionIndex < competitions.length; competitionIndex += 1) {
      const competition = competitions[competitionIndex];
      const competitionRegistrations: Registration[] = [];
      for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
        const team = teams[teamIndex];
        const eligible = team.participants.filter(participant => participant.categoryId === competition.categoryId);
        assert(eligible.length >= 2, `${team.code} has insufficient participants for ${competition.categoryName}.`);
        const body = competition.type === 'GROUP'
          ? {
              competitionId: competition.id,
              participantName: `${team.name} Ensemble`,
              groupMembers: eligible.slice(0, 2).map(participant => participant.id)
            }
          : {
              competitionId: competition.id,
              participantId: eligible[(competitionIndex + teamIndex) % eligible.length].id
            };
        const response = await api<{ registration: Registration }>(
          'competitionRegistration',
          `/api/team/${encodeURIComponent(team.id)}/registrations`,
          body,
          team.token
        );
        assert(response.registration.categoryId === competition.categoryId,
          `Registration category mismatch for ${competition.code}.`);
        assert(response.registration.type === competition.type,
          `Registration type mismatch for ${competition.code}.`);
        if (competition.type === 'GROUP') {
          assert(response.registration.groupMembers?.length === 2,
            `Group registration does not contain two members for ${competition.code}.`);
          assert(response.registration.groupMembers.every(id =>
            team.participants.some(participant =>
              participant.id === id && participant.categoryId === competition.categoryId
            )
          ), `Group registration contains an ineligible member for ${competition.code}.`);
        } else {
          assert(response.registration.chestNumber.startsWith('#'),
            `Individual registration has no generated bib/chest number for ${competition.code}.`);
          assert(response.registration.participantId === body.participantId,
            `Individual registration points to the wrong participant for ${competition.code}.`);
        }
        assert(!registrationCodes.has(response.registration.code),
          `Registration code ${response.registration.code} is not globally unique.`);
        registrationCodes.add(response.registration.code);
        competitionRegistrations.push(response.registration);
      }
      registrationsByCompetition.push(competitionRegistrations);
      assert(new Set(competitionRegistrations.map(registration => registration.chestNumber)).size === 4,
        `Chest numbers are not unique for ${competition.code}.`);
    }

    const assignments: Array<{
      id: string;
      accessCode: string;
      secret: string;
      judgeNumber: number;
      competition: Competition;
    }> = [];
    for (let competitionIndex = 0; competitionIndex < competitions.length; competitionIndex += 1) {
      const competition = competitions[competitionIndex];
      const response = await api<{
        assignment: { id: string; accessCode: string; secretHash?: string; salt?: string };
        oneTimeSecret: string;
      }>('judgeAssignment', '/api/admin/judge-assignments', {
        competitionId: competition.id,
        judgeName: `${runId} Judge ${(competitionIndex % 10) + 1}`,
        judgePhone: `+919910000${String(competitionIndex % 10).padStart(2, '0')}`
      }, adminToken);
      assert(!response.assignment.secretHash && !response.assignment.salt,
        'Judge assignment API must not expose credential hashes or salts.');
      assignments.push({
        id: response.assignment.id,
        accessCode: response.assignment.accessCode,
        secret: response.oneTimeSecret,
        judgeNumber: (competitionIndex % 10) + 1,
        competition
      });
    }
    assert(new Set(assignments.map(assignment => assignment.accessCode)).size === 100,
      'Judge assignment access codes are not unique.');
    assert(Array.from({ length: 10 }, (_, index) =>
      assignments.filter(assignment => assignment.judgeNumber === index + 1).length === 10
    ).every(Boolean), 'Each of the 10 judges must receive exactly 10 competitions.');

    for (let index = 0; index < assignments.length; index += 1) {
      const assignment = assignments[index];
      const response = await api<{ success: boolean; assignment: { id: string }; registrations: Registration[] }>(
        'judgeLogin',
        '/api/judge/login',
        {
          accessCode: assignment.accessCode,
          competitionId: assignment.competition.id,
          secret: assignment.secret
        }
      );
      assert(response.success && response.assignment.id === assignment.id, 'Judge login returned the wrong assignment.');
      assert(response.registrations.length === 4, 'Judge login did not return the complete competition roster.');
    }

    for (let competitionIndex = 0; competitionIndex < competitions.length; competitionIndex += 1) {
      const competition = competitions[competitionIndex];
      const registrations = registrationsByCompetition[competitionIndex];
      const scoreTotals = [96, 85, 65, 55];
      const marks = Object.fromEntries(registrations.map((registration, teamIndex) => {
        const total = scoreTotals[teamIndex];
        const first = Math.round(total * 0.4);
        const second = Math.round(total * 0.3);
        return [registration.id, {
          'criterion-1': first,
          'criterion-2': second,
          'criterion-3': total - first - second
        }];
      }));
      const assignment = assignments[competitionIndex];
      const response = await api<{ success: boolean; marksRecorded: number; verificationHash: string }>(
        'judgeSubmit',
        '/api/judge/marks',
        {
          action: 'SUBMIT',
          assignmentId: assignment.id,
          competitionId: competition.id,
          secret: assignment.secret,
          scores: marks
        }
      );
      assert(response.success && response.marksRecorded === 4 && response.verificationHash.startsWith('SHA256:'),
        `Judge marks were not accepted for ${competition.code}.`);
    }

    for (const competition of competitions) {
      const resultRef = adminDb.collection('results').doc(`res-${competition.id}`);
      const resultSnapshot = await resultRef.get();
      assert(resultSnapshot.exists, `Judge submission did not create a review result for ${competition.code}.`);
      const result = resultSnapshot.data()!;
      assert(result.resultStatus === 'READY_FOR_REVIEW' && result.ranks.length === 4,
        `Result review state is incomplete for ${competition.code}.`);
      const confirmation = await api<{ success: boolean }>(
        'resultConfirm',
        `/api/admin/results/${encodeURIComponent(resultSnapshot.id)}`,
        { action: 'CONFIRM', ranks: result.ranks },
        adminToken
      );
      assert(confirmation.success, `Admin could not confirm ${competition.code}.`);
    }

    const teamIds = teams.map(team => team.id);
    observers.push(...await Promise.all([
      createObserver('browser-a', teamIds),
      createObserver('browser-b', teamIds)
    ]));
    const baselineResults = observers.slice(0, 2).map(observer => observer.resultCount);

    const publication = await api<{ success: boolean; resultsPublished: number; entriesCommitted: number }>(
      'resultPublish',
      '/api/admin/results/publish',
      { resultIds: competitions.map(competition => `res-${competition.id}`) },
      adminToken
    );
    assert(publication.resultsPublished === 100 && publication.entriesCommitted === 400,
      'Bulk publication did not commit all 100 results and 400 ledger entries.');

    await waitFor(
      () => observers.slice(0, 2).every((observer, index) => observer.resultCount >= baselineResults[index] + 100),
      'The two public Firestore listeners did not receive all 100 published results.'
    );

    const publishedResults = await adminDb.collection('results')
      .where('resultStatus', '==', 'PUBLISHED')
      .get();
    const runResults = publishedResults.docs.filter(doc => competitions.some(comp => doc.id === `res-${comp.id}`));
    assert(runResults.length === 100, `Expected 100 published simulation results, received ${runResults.length}.`);
    runResults.forEach(resultSnapshot => {
      const result = resultSnapshot.data();
      const ranks = result.ranks as Array<{
        registrationId: string;
        rank: 1 | 2 | 3 | null;
        score: number;
        grade: string;
        officialPoints: number;
      }>;
      assert(result.resultStatus === 'PUBLISHED' && ranks.length === 4,
        `Published result ${resultSnapshot.id} is incomplete.`);
      ranks.forEach(rank => {
        const expectedGrade = calculateGrade(rank.score, 100);
        const expectedPoints = getChampionshipPoints(result.type, expectedGrade, rank.rank);
        assert(rank.grade === expectedGrade && rank.officialPoints === expectedPoints,
          `Grade or points calculation is incorrect for registration ${rank.registrationId}.`);
      });
    });

    const resultIds = competitions.map(competition => `res-${competition.id}`);
    const ledgerEntries = [];
    for (let index = 0; index < resultIds.length; index += 30) {
      const snapshot = await adminDb.collection('pointsLedger')
        .where('resultId', 'in', resultIds.slice(index, index + 30))
        .get();
      ledgerEntries.push(...snapshot.docs.filter(doc => doc.data().status === 'COMMITTED'));
    }
    assert(ledgerEntries.length === 400, `Expected 400 committed ledger entries, received ${ledgerEntries.length}.`);

    const competitionIdChunks = Array.from({ length: Math.ceil(competitions.length / 30) }, (_, index) =>
      competitions.slice(index * 30, (index + 1) * 30).map(competition => competition.id)
    );
    const [participantSnapshot, registrationSnapshots, assignmentSnapshots, markSnapshots] = await Promise.all([
      adminDb.collection('participants').where('teamId', 'in', teamIds).get(),
      Promise.all(competitionIdChunks.map(ids =>
        adminDb.collection('registrations').where('competitionId', 'in', ids).get()
      )),
      Promise.all(competitionIdChunks.map(ids =>
        adminDb.collection('judgeAssignments').where('competitionId', 'in', ids).get()
      )),
      Promise.all(competitionIdChunks.map(ids =>
        adminDb.collection('markEntries').where('competitionId', 'in', ids).get()
      ))
    ]);
    const registrationDocs = registrationSnapshots.flatMap(snapshot => snapshot.docs);
    const assignmentDocs = assignmentSnapshots.flatMap(snapshot => snapshot.docs);
    const markDocs = markSnapshots.flatMap(snapshot => snapshot.docs);
    assert(participantSnapshot.size === 40, `Expected 40 simulation participants, received ${participantSnapshot.size}.`);
    assert(registrationDocs.length === 400, `Expected 400 persisted registrations, received ${registrationDocs.length}.`);
    assert(assignmentDocs.length === 100 && markDocs.length === 100,
      `Expected 100 assignments and submitted scorecards, received ${assignmentDocs.length} and ${markDocs.length}.`);
    assert(new Set(participantSnapshot.docs.map(doc => doc.data().bib)).size === 40,
      'Participant bib numbers are not globally unique.');
    const simulationRegistrationIds = new Set(registrationDocs.map(doc => doc.id));
    assert(ledgerEntries.every(entry => simulationRegistrationIds.has(entry.data().registrationId)),
      'A committed points entry references a registration outside this simulation.');

    const teamTotals = new Map<string, number>();
    ledgerEntries.forEach(entry => {
      const data = entry.data();
      teamTotals.set(data.teamId, (teamTotals.get(data.teamId) || 0) + data.points);
    });
    const leaderboardDocs = await Promise.all(teamIds.map(teamId => adminDb.collection('leaderboard').doc(teamId).get()));
    leaderboardDocs.forEach(snapshot => {
      const expected = teamTotals.get(snapshot.id) || 0;
      assert(snapshot.exists && snapshot.data()?.totalPoints === expected,
        `Leaderboard points did not match the ledger for ${snapshot.id}.`);
    });
    await waitFor(
      () => observers.slice(0, 2).every(observer => teamIds.every(teamId =>
        observer.teams[teamId]?.totalPoints === teamTotals.get(teamId) &&
        observer.leaderboard[teamId]?.totalPoints === teamTotals.get(teamId)
      )),
      'Live leaderboard or team standings listeners did not converge to the published ledger totals.'
    );

    const competitionSnapshots = await Promise.all(competitions.map(competition =>
      adminDb.collection('competitions').doc(competition.id).get()
    ));
    assert(competitionSnapshots.every(snapshot =>
      snapshot.data()?.entriesCount === 4 &&
      Array.isArray(snapshot.data()?.assignedJudges) &&
      snapshot.data()?.assignedJudges.length === 1
    ), 'Competition entry counts or assigned judge metadata do not match expected totals.');

    const timingsReport = Object.fromEntries(Object.entries(timings).map(([label, values]) => [label, {
      requests: values.length,
      p95Ms: Math.round(percentile(values, 0.95)),
      maxMs: Math.round(Math.max(...values))
    }]));
    console.log(JSON.stringify({
      success: true,
      projectId,
      runId,
      categories: categories.length,
      teams: teams.length,
      participants: participantSnapshot.size,
      competitions: competitions.length,
      registrations: 400,
      groupCompetitions: competitions.filter(comp => comp.type === 'GROUP').length,
      soloCompetitions: competitions.filter(comp => comp.type === 'SOLO').length,
      judges: 10,
      judgeAssignments: assignments.length,
      submittedScorecards: markDocs.length,
      publishedResults: runResults.length,
      committedLedgerEntries: ledgerEntries.length,
      realtimeBrowsers: 2,
      realtimePublishedResultCount: observers.slice(0, 2).map(observer => observer.resultCount),
      teamTotals: Object.fromEntries(teamTotals),
      timings: timingsReport
    }, null, 2));

  } finally {
    observers.forEach(observer => observer.unsubscribe());
    await Promise.all(observers.map(observer => deleteApp(observer.app).catch(() => undefined)));
    await signOut(clientAuth).catch(() => undefined);
    await deleteApp(clientApp).catch(() => undefined);
  }
}

void main().catch(error => {
  console.error('Full fest emulator simulation failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
