/**
 * Seed Demo Data Script for Sahithyolsav 2025 Local Backend
 * Seeds all 18 Firestore collections and demo Auth accounts against Local Firebase Emulators.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { hashSecret } from '../src/domain/judgeAuth';
import { calculateGradeFromPercentage, getChampionshipPoints } from '../src/domain/scoring';

// Ensure emulator environment variables
process.env.GCLOUD_PROJECT = 'demo-sahithyolsav-2025';
process.env.FIREBASE_CONFIG = '{"projectId":"demo-sahithyolsav-2025"}';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-sahithyolsav-2025' }) : getApps()[0]!;
const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  console.log('🚀 Starting Sahithyolsav 2025 Demo Data Seeding to Local Emulators...');

  // 1. CREATE AUTH ACCOUNTS
  console.log('👤 Seeding Auth Accounts...');
  const demoUsers = [
    { uid: 'admin-01', email: 'admin@sahithyolsav.com', password: 'AdminPassword123!', displayName: 'Chief Festival Admin', role: 'ADMIN' },
    { uid: 'tm-shamama', email: 'manager.shamama@sahithyolsav.com', password: 'TeamPassword123!', displayName: 'Shamama Team Manager', role: 'TEAM_MANAGER', teamId: 'team-1' },
    { uid: 'tm-nawa', email: 'manager.nawa@sahithyolsav.com', password: 'TeamPassword123!', displayName: 'Nawa Team Manager', role: 'TEAM_MANAGER', teamId: 'team-2' },
    { uid: 'tm-ishraq', email: 'manager.ishraq@sahithyolsav.com', password: 'TeamPassword123!', displayName: 'Ishraq Team Manager', role: 'TEAM_MANAGER', teamId: 'team-3' },
    { uid: 'tm-rawda', email: 'manager.rawda@sahithyolsav.com', password: 'TeamPassword123!', displayName: 'Rawda Team Manager', role: 'TEAM_MANAGER', teamId: 'team-4' }
  ];

  for (const u of demoUsers) {
    try {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: u.password,
        displayName: u.displayName
      });
      await auth.setCustomUserClaims(u.uid, { role: u.role, teamId: u.teamId });
      console.log(`  ✔ Created Auth user: ${u.email} (${u.role})`);
    } catch (err: any) {
      if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
        console.log(`  ℹ Auth user exists: ${u.email}`);
      } else {
        console.warn(`  ⚠ Warning creating auth user ${u.email}:`, err.message);
      }
    }

    // Write to users collection
    await db.collection('users').doc(u.uid).set({
      id: u.uid,
      email: u.email,
      name: u.displayName,
      role: u.role,
      teamId: u.teamId || null,
      teamName: u.teamId === 'team-1' ? 'Al-Shamama' : u.teamId === 'team-2' ? 'An-Nawa' : u.teamId === 'team-3' ? 'Al-Ishraq' : u.teamId === 'team-4' ? 'Ar-Rawda' : null,
      status: 'ACTIVE',
      disabled: false,
      createdAt: new Date().toISOString()
    }, { merge: true });
  }

  // 2. CATEGORIES
  console.log('🏷 Seeding Categories...');
  const categories = [
    { id: 'cat-1', name: 'Sub Junior', code: 'CAT-SJ', eligibility: 'Class 5 to 7', ageRange: '10 - 12 Years', classRange: 'Std 5 - 7', enrolledCount: 94, competitionsCount: 10, status: 'ACTIVE' },
    { id: 'cat-2', name: 'Junior', code: 'CAT-JR', eligibility: 'Class 8 to 10', ageRange: '13 - 15 Years', classRange: 'Std 8 - 10', enrolledCount: 148, competitionsCount: 14, status: 'ACTIVE' },
    { id: 'cat-3', name: 'Senior', code: 'CAT-SR', eligibility: 'Class 11 to 12', ageRange: '16 - 18 Years', classRange: 'Std 11 - 12', enrolledCount: 162, competitionsCount: 16, status: 'ACTIVE' },
    { id: 'cat-4', name: 'General', code: 'CAT-GEN', eligibility: 'All Eligible Students', ageRange: 'Open Tier', classRange: 'Campus Wide', enrolledCount: 78, competitionsCount: 8, status: 'ACTIVE' }
  ];
  for (const c of categories) {
    await db.collection('categories').doc(c.id).set(c);
  }

  // 3. TEAMS
  console.log('🚩 Seeding Teams...');
  const teams = [
    { id: 'team-1', name: 'Al-Shamama', code: 'SHA', color: '#2563EB', badgeBg: 'bg-blue-100 text-blue-700', slogan: 'Vanguard of Literary Wisdom', managerName: 'Rashid Ahammed', totalPoints: 73, soloPoints: 42, groupPoints: 31, rank: 1, firstCount: 4, secondCount: 2, thirdCount: 1, contestantsCount: 48, eventsCount: 32, status: 'ACTIVE' },
    { id: 'team-2', name: 'An-Nawa', code: 'NAW', color: '#059669', badgeBg: 'bg-emerald-100 text-emerald-700', slogan: 'Crest of Cultural Resurgence', managerName: 'Hafiz Farooq', totalPoints: 61, soloPoints: 38, groupPoints: 23, rank: 2, firstCount: 2, secondCount: 3, thirdCount: 2, contestantsCount: 46, eventsCount: 30, status: 'ACTIVE' },
    { id: 'team-3', name: 'Al-Ishraq', code: 'ISH', color: '#D97706', badgeBg: 'bg-amber-100 text-amber-700', slogan: 'Radiance of Poetic Eloquence', managerName: 'Luqman V.P.', totalPoints: 52, soloPoints: 32, groupPoints: 20, rank: 3, firstCount: 2, secondCount: 1, thirdCount: 3, contestantsCount: 45, eventsCount: 29, status: 'ACTIVE' },
    { id: 'team-4', name: 'Ar-Rawda', code: 'RAW', color: '#DC2626', badgeBg: 'bg-rose-100 text-rose-700', slogan: 'Meadow of Creative Artistry', managerName: 'Zubair K.M.', totalPoints: 44, soloPoints: 26, groupPoints: 18, rank: 4, firstCount: 1, secondCount: 2, thirdCount: 2, contestantsCount: 42, eventsCount: 28, status: 'ACTIVE' }
  ];
  for (const t of teams) {
    await db.collection('teams').doc(t.id).set(t);
  }

  // 4. STAGES
  console.log('🏛 Seeding Stages...');
  const stages = [
    { id: 'stage-1', name: 'Stage 1 - Main Auditorium', code: 'STG-01', location: 'Main Cultural Hall, Ground Floor', capacity: 800, currentEvent: 'Qur\'an Recitation', status: 'ACTIVE' },
    { id: 'stage-2', name: 'Stage 2 - Seminar Hall', code: 'STG-02', location: 'Academic Block B, 2nd Floor', capacity: 300, currentEvent: 'Elocution Malayalam', status: 'ACTIVE' },
    { id: 'stage-3', name: 'Stage 3 - Open Amphitheater', code: 'STG-03', location: 'Campus Central Courtyard', capacity: 1200, currentEvent: 'Duffmuttu Performance', status: 'ACTIVE' },
    { id: 'stage-4', name: 'Stage 4 - Green Lawn', code: 'STG-04', location: 'Heritage Lawn', capacity: 250, currentEvent: 'Mappilappattu Solo', status: 'ACTIVE' }
  ];
  for (const s of stages) {
    await db.collection('stages').doc(s.id).set(s);
  }

  // 5. COMPETITIONS
  console.log('🏆 Seeding Competitions...');
  const competitions = [
    { id: 'comp-1', name: 'Qur\'an Recitation (Murattal)', code: 'QRN-SR', categoryId: 'cat-3', categoryName: 'Senior', type: 'SOLO', stageId: 'stage-1', stageName: 'Stage 1 - Main Auditorium', durationMinutes: 7, maxRegistrationsPerTeam: 2, entriesCount: 8, status: 'PUBLISHED' },
    { id: 'comp-2', name: 'Elocution (Malayalam)', code: 'ELO-MAL-JR', categoryId: 'cat-2', categoryName: 'Junior', type: 'SOLO', stageId: 'stage-2', stageName: 'Stage 2 - Seminar Hall', durationMinutes: 5, maxRegistrationsPerTeam: 1, entriesCount: 4, status: 'PUBLISHED' },
    { id: 'comp-3', name: 'Duffmuttu (Choreographed)', code: 'DUF-GEN', categoryId: 'cat-4', categoryName: 'General', type: 'GROUP', stageId: 'stage-3', stageName: 'Stage 3 - Open Amphitheater', durationMinutes: 12, maxRegistrationsPerTeam: 1, entriesCount: 4, status: 'COMPLETED' },
    { id: 'comp-4', name: 'Mappilappattu (Solo)', code: 'MAP-SJ', categoryId: 'cat-1', categoryName: 'Sub Junior', type: 'SOLO', stageId: 'stage-4', stageName: 'Stage 4 - Green Lawn', durationMinutes: 6, maxRegistrationsPerTeam: 2, entriesCount: 8, status: 'IN_PROGRESS' },
    { id: 'comp-5', name: 'Arabic Calligraphy (Thuluth)', code: 'CAL-SR', categoryId: 'cat-3', categoryName: 'Senior', type: 'SOLO', stageId: 'stage-2', stageName: 'Stage 2 - Seminar Hall', durationMinutes: 90, maxRegistrationsPerTeam: 1, entriesCount: 4, status: 'SCHEDULED' },
    { id: 'comp-6', name: 'Qawwali (Group)', code: 'QAW-SR', categoryId: 'cat-3', categoryName: 'Senior', type: 'GROUP', stageId: 'stage-1', stageName: 'Stage 1 - Main Auditorium', durationMinutes: 15, maxRegistrationsPerTeam: 1, entriesCount: 4, status: 'SCHEDULED' }
  ];
  for (const cmp of competitions) {
    await db.collection('competitions').doc(cmp.id).set(cmp);
  }

  // 6. PARTICIPANTS
  console.log('🎓 Seeding Participants...');
  const participants = [
    { id: 'part-101', bib: 'BIB-101', name: 'Ameen Farhan K.P.', teamId: 'team-1', teamName: 'Al-Shamama', teamCode: 'SHA', categoryId: 'cat-3', categoryName: 'Senior', classGrade: 'Class 12', division: 'A', idStatus: 'ISSUED', registeredEventIds: ['comp-1', 'comp-5'] },
    { id: 'part-102', bib: 'BIB-102', name: 'Muhammad Sinan T.', teamId: 'team-2', teamName: 'An-Nawa', teamCode: 'NAW', categoryId: 'cat-3', categoryName: 'Senior', classGrade: 'Class 12', division: 'B', idStatus: 'ISSUED', registeredEventIds: ['comp-1'] },
    { id: 'part-103', bib: 'BIB-103', name: 'Bilal Shahid', teamId: 'team-3', teamName: 'Al-Ishraq', teamCode: 'ISH', categoryId: 'cat-3', categoryName: 'Senior', classGrade: 'Class 11', division: 'A', idStatus: 'ISSUED', registeredEventIds: ['comp-1'] },
    { id: 'part-104', bib: 'BIB-104', name: 'Rayyan Abdulla', teamId: 'team-4', teamName: 'Ar-Rawda', teamCode: 'RAW', categoryId: 'cat-3', categoryName: 'Senior', classGrade: 'Class 11', division: 'C', idStatus: 'ISSUED', registeredEventIds: ['comp-1'] },
    { id: 'part-201', bib: 'BIB-201', name: 'Zayan Ahmed', teamId: 'team-1', teamName: 'Al-Shamama', teamCode: 'SHA', categoryId: 'cat-2', categoryName: 'Junior', classGrade: 'Class 9', division: 'A', idStatus: 'ISSUED', registeredEventIds: ['comp-2'] },
    { id: 'part-202', bib: 'BIB-202', name: 'Hanan Mustafa', teamId: 'team-2', teamName: 'An-Nawa', teamCode: 'NAW', categoryId: 'cat-2', categoryName: 'Junior', classGrade: 'Class 10', division: 'B', idStatus: 'ISSUED', registeredEventIds: ['comp-2'] },
    { id: 'part-301', bib: 'BIB-301', name: 'Ihsanullah V.K.', teamId: 'team-1', teamName: 'Al-Shamama', teamCode: 'SHA', categoryId: 'cat-1', categoryName: 'Sub Junior', classGrade: 'Class 6', division: 'A', idStatus: 'ISSUED', registeredEventIds: ['comp-4'] }
  ];
  for (const p of participants) {
    await db.collection('participants').doc(p.id).set(p);
  }

  // 7. REGISTRATIONS
  console.log('📝 Seeding Registrations...');
  const registrations = [
    { id: 'reg-01', code: 'REG-QRN-101', competitionId: 'comp-1', competitionName: 'Qur\'an Recitation (Murattal)', teamId: 'team-1', teamName: 'Al-Shamama', categoryId: 'cat-3', type: 'SOLO', participantId: 'part-101', participantName: 'Ameen Farhan K.P.', bib: 'BIB-101', status: 'APPROVED', registeredAt: '2025-10-14T09:30:00Z' },
    { id: 'reg-02', code: 'REG-QRN-102', competitionId: 'comp-1', competitionName: 'Qur\'an Recitation (Murattal)', teamId: 'team-2', teamName: 'An-Nawa', categoryId: 'cat-3', type: 'SOLO', participantId: 'part-102', participantName: 'Muhammad Sinan T.', bib: 'BIB-102', status: 'APPROVED', registeredAt: '2025-10-14T09:32:00Z' },
    { id: 'reg-03', code: 'REG-QRN-103', competitionId: 'comp-1', competitionName: 'Qur\'an Recitation (Murattal)', teamId: 'team-3', teamName: 'Al-Ishraq', categoryId: 'cat-3', type: 'SOLO', participantId: 'part-103', participantName: 'Bilal Shahid', bib: 'BIB-103', status: 'APPROVED', registeredAt: '2025-10-14T09:35:00Z' },
    { id: 'reg-04', code: 'REG-QRN-104', competitionId: 'comp-1', competitionName: 'Qur\'an Recitation (Murattal)', teamId: 'team-4', teamName: 'Ar-Rawda', categoryId: 'cat-3', type: 'SOLO', participantId: 'part-104', participantName: 'Rayyan Abdulla', bib: 'BIB-104', status: 'APPROVED', registeredAt: '2025-10-14T09:40:00Z' },
    { id: 'reg-05', code: 'REG-ELO-201', competitionId: 'comp-2', competitionName: 'Elocution (Malayalam)', teamId: 'team-1', teamName: 'Al-Shamama', categoryId: 'cat-2', type: 'SOLO', participantId: 'part-201', participantName: 'Zayan Ahmed', bib: 'BIB-201', status: 'APPROVED', registeredAt: '2025-10-14T10:00:00Z' },
    { id: 'reg-06', code: 'REG-ELO-202', competitionId: 'comp-2', competitionName: 'Elocution (Malayalam)', teamId: 'team-2', teamName: 'An-Nawa', categoryId: 'cat-2', type: 'SOLO', participantId: 'part-202', participantName: 'Hanan Mustafa', bib: 'BIB-202', status: 'APPROVED', registeredAt: '2025-10-14T10:05:00Z' }
  ];
  for (const r of registrations) {
    await db.collection('registrations').doc(r.id).set(r);
  }

  // 8. SCHEDULES
  console.log('📅 Seeding Schedules...');
  const schedules = [
    { id: 'sch-1', competitionId: 'comp-1', competitionName: 'Qur\'an Recitation (Murattal)', stageId: 'stage-1', stageName: 'Stage 1 - Main Auditorium', startTime: '09:00 AM', endTime: '11:00 AM', date: '2025-10-25', status: 'COMPLETED' },
    { id: 'sch-2', competitionId: 'comp-2', competitionName: 'Elocution (Malayalam)', stageId: 'stage-2', stageName: 'Stage 2 - Seminar Hall', startTime: '09:30 AM', endTime: '11:00 AM', date: '2025-10-25', status: 'COMPLETED' },
    { id: 'sch-3', competitionId: 'comp-3', competitionName: 'Duffmuttu (Choreographed)', stageId: 'stage-3', stageName: 'Stage 3 - Open Amphitheater', startTime: '02:00 PM', endTime: '04:30 PM', date: '2025-10-25', status: 'COMPLETED' },
    { id: 'sch-4', competitionId: 'comp-4', competitionName: 'Mappilappattu (Solo)', stageId: 'stage-4', stageName: 'Stage 4 - Green Lawn', startTime: '11:30 AM', endTime: '01:00 PM', date: '2025-10-25', status: 'IN_PROGRESS' },
    { id: 'sch-5', competitionId: 'comp-5', competitionName: 'Arabic Calligraphy (Thuluth)', stageId: 'stage-2', stageName: 'Stage 2 - Seminar Hall', startTime: '02:00 PM', endTime: '03:30 PM', date: '2025-10-26', status: 'SCHEDULED' },
    { id: 'sch-6', competitionId: 'comp-6', competitionName: 'Qawwali (Group)', stageId: 'stage-1', stageName: 'Stage 1 - Main Auditorium', startTime: '04:00 PM', endTime: '06:00 PM', date: '2025-10-26', status: 'SCHEDULED' }
  ];
  for (const s of schedules) {
    await db.collection('schedules').doc(s.id).set(s);
  }

  // 9. JUDGES & JUDGE ASSIGNMENTS
  console.log('⚖ Seeding Judges & Secure Assignments...');
  const judges = [
    { id: 'jdg-1', name: 'Dr. Abdul Azeez Al-Bukhari', phone: '+91 98471 23456', specialization: 'Qur\'an Tajweed & Qira\'at', status: 'ACTIVE' },
    { id: 'jdg-2', name: 'Prof. K.P. Ramanunni', phone: '+91 94472 34567', specialization: 'Malayalam Literature & Rhetoric', status: 'ACTIVE' },
    { id: 'jdg-3', name: 'Ustad Shoukathali Usthad', phone: '+91 98950 11223', specialization: 'Traditional Folk & Duffmuttu', status: 'ACTIVE' }
  ];
  for (const j of judges) {
    await db.collection('judges').doc(j.id).set(j);
  }

  const salt1 = 'salt-101-quran';
  const secret1 = 'Sahithya@2025';
  const hashedSecret1 = await hashSecret(secret1, salt1);

  const now = new Date();
  const futureExp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const futureExpiresAt = futureExp.toISOString();
  const futureExpiresAtMs = futureExp.getTime();

  const pastExp = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const pastExpiresAt = pastExp.toISOString();
  const pastExpiresAtMs = pastExp.getTime();

  const judgeAssignments = [
    {
      id: 'asg-01',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      judgeId: 'jdg-1',
      judgeName: 'Dr. Abdul Azeez Al-Bukhari',
      judgePhone: '+91 98471 23456',
      accessCode: 'JRY-9421',
      salt: salt1,
      hashedSecret: hashedSecret1,
      directUrl: 'http://localhost:3000/judge/login?code=JRY-9421',
      status: 'SUBMITTED',
      expiresAt: futureExpiresAt,
      expiresAtMs: futureExpiresAtMs,
      submittedAt: now.toISOString(),
      createdAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: 'asg-02',
      competitionId: 'comp-2',
      competitionName: 'Elocution (English)',
      judgeId: 'jdg-2',
      judgeName: 'Prof. Maryam Al-Kindi',
      judgePhone: '+91 98471 65432',
      accessCode: 'JRY-4821',
      salt: salt1,
      hashedSecret: hashedSecret1,
      directUrl: 'http://localhost:3000/judge/login?code=JRY-4821',
      status: 'ACTIVE',
      expiresAt: futureExpiresAt,
      expiresAtMs: futureExpiresAtMs,
      createdAt: now.toISOString()
    },
    {
      id: 'asg-expired-demo',
      competitionId: 'comp-3',
      competitionName: 'Calligraphy',
      judgeId: 'jdg-3',
      judgeName: 'Usthad Tariq Jameel',
      judgePhone: '+91 98471 99999',
      accessCode: 'JRY-9999',
      salt: salt1,
      hashedSecret: hashedSecret1,
      directUrl: 'http://localhost:3000/judge/login?code=JRY-9999',
      status: 'ACTIVE',
      expiresAt: pastExpiresAt,
      expiresAtMs: pastExpiresAtMs,
      createdAt: new Date(now.getTime() - 48 * 3600 * 1000).toISOString()
    }
  ];
  for (const asg of judgeAssignments) {
    await db.collection('judgeAssignments').doc(asg.id).set(asg);
  }

  // 10. MARK ENTRIES
  console.log('📊 Seeding Mark Entries...');
  const markEntries = [
    {
      id: 'me-01',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      category: 'Senior',
      judgeName: 'Dr. Abdul Azeez Al-Bukhari',
      status: 'SUBMITTED',
      submittedAt: '2025-10-25T11:15:00Z',
      scores: [
        { bib: 'BIB-101', participantName: 'Ameen Farhan K.P.', teamName: 'Al-Shamama', marks: 95, grade: 'A+', feedback: 'Excellent Tajweed and breath control.' },
        { bib: 'BIB-102', participantName: 'Muhammad Sinan T.', teamName: 'An-Nawa', marks: 88, grade: 'A', feedback: 'Very melodious pronunciation.' },
        { bib: 'BIB-103', participantName: 'Bilal Shahid', teamName: 'Al-Ishraq', marks: 74, grade: 'A', feedback: 'Clear articulation, improve rhythm.' },
        { bib: 'BIB-104', participantName: 'Rayyan Abdulla', teamName: 'Ar-Rawda', marks: 66, grade: 'B', feedback: 'Good effort.' }
      ]
    }
  ];
  for (const me of markEntries) {
    await db.collection('markEntries').doc(me.id).set(me);
  }

  // 11. RESULTS & POINTS LEDGER
  console.log('🏅 Seeding Results & Ledger...');
  const result1 = {
    id: 'res-1',
    competitionId: 'comp-1',
    competitionCode: 'QRN-SR',
    competitionName: 'Qur\'an Recitation (Murattal)',
    category: 'Senior',
    type: 'SOLO',
    totalEntries: 4,
    evaluatedEntries: 4,
    status: 'PUBLISHED',
    resultStatus: 'PUBLISHED',
    ranks: [
      { rank: 1, bib: 'BIB-101', name: 'Ameen Farhan K.P.', teamName: 'Al-Shamama', teamCode: 'SHA', score: 95, grade: 'A+', points: 11 },
      { rank: 2, bib: 'BIB-102', name: 'Muhammad Sinan T.', teamName: 'An-Nawa', teamCode: 'NAW', score: 88, grade: 'A', points: 8 },
      { rank: 3, bib: 'BIB-103', name: 'Bilal Shahid', teamName: 'Al-Ishraq', teamCode: 'ISH', score: 74, grade: 'A', points: 6 }
    ],
    posterReleased: true,
    posterConfig: {
      aspectRatio: '1:1',
      colorPreset: 'royal',
      fontFamily: 'Montserrat',
      fontSize: 'standard',
      fontWeight: '700'
    },
    publishedAt: '2025-10-25T11:45:00Z',
    publishedBy: 'Chief Festival Admin'
  };
  await db.collection('results').doc(result1.id).set(result1);

  // Points Ledger for Result 1 (Sahithyolsav official 40-cell matrix applied)
  const ledgerEntries = [
    {
      id: 'ledg-res-1-1',
      resultId: 'res-1',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      categoryName: 'Senior',
      competitionType: 'SOLO',
      teamId: 'team-1',
      teamName: 'Al-Shamama',
      teamCode: 'SHA',
      participantId: 'part-101',
      participantName: 'Ameen Farhan K.P.',
      bib: 'BIB-101',
      position: 1,
      grade: 'A+',
      pointsAwarded: 11,
      committedAt: '2025-10-25T11:45:00Z',
      committedBy: 'Chief Festival Admin',
      status: 'ACTIVE'
    },
    {
      id: 'ledg-res-1-2',
      resultId: 'res-1',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      categoryName: 'Senior',
      competitionType: 'SOLO',
      teamId: 'team-2',
      teamName: 'An-Nawa',
      teamCode: 'NAW',
      participantId: 'part-102',
      participantName: 'Muhammad Sinan T.',
      bib: 'BIB-102',
      position: 2,
      grade: 'A',
      pointsAwarded: 8,
      committedAt: '2025-10-25T11:45:00Z',
      committedBy: 'Chief Festival Admin',
      status: 'ACTIVE'
    },
    {
      id: 'ledg-res-1-3',
      resultId: 'res-1',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      categoryName: 'Senior',
      competitionType: 'SOLO',
      teamId: 'team-3',
      teamName: 'Al-Ishraq',
      teamCode: 'ISH',
      participantId: 'part-103',
      participantName: 'Bilal Shahid',
      bib: 'BIB-103',
      position: 3,
      grade: 'A',
      pointsAwarded: 6,
      committedAt: '2025-10-25T11:45:00Z',
      committedBy: 'Chief Festival Admin',
      status: 'ACTIVE'
    }
  ];
  for (const led of ledgerEntries) {
    await db.collection('pointsLedger').doc(led.id).set(led);
  }

  // 12. LEADERBOARD
  console.log('📈 Seeding Leaderboard...');
  const leaderboard = [
    { teamId: 'team-1', teamName: 'Al-Shamama', teamCode: 'SHA', rank: 1, totalPoints: 73, soloPoints: 42, groupPoints: 31, firstCount: 4, secondCount: 2, thirdCount: 1, updatedAt: new Date().toISOString() },
    { teamId: 'team-2', teamName: 'An-Nawa', teamCode: 'NAW', rank: 2, totalPoints: 61, soloPoints: 38, groupPoints: 23, firstCount: 2, secondCount: 3, thirdCount: 2, updatedAt: new Date().toISOString() },
    { teamId: 'team-3', teamName: 'Al-Ishraq', teamCode: 'ISH', rank: 3, totalPoints: 52, soloPoints: 32, groupPoints: 20, firstCount: 2, secondCount: 1, thirdCount: 3, updatedAt: new Date().toISOString() },
    { teamId: 'team-4', teamName: 'Ar-Rawda', teamCode: 'RAW', rank: 4, totalPoints: 44, soloPoints: 26, groupPoints: 18, firstCount: 1, secondCount: 2, thirdCount: 2, updatedAt: new Date().toISOString() }
  ];
  for (const lb of leaderboard) {
    await db.collection('leaderboard').doc(lb.teamId).set(lb);
  }

  // 13. SETTINGS & THEME
  console.log('⚙ Seeding System Settings...');
  await db.collection('settings').doc('theme').set({
    festivalName: 'Sahithyolsav 2025',
    institutionName: 'Markaz Knowledge City',
    tagline: 'Annual Arts & Cultural Fest',
    year: '2025',
    primaryColor: '#2563EB',
    secondaryColor: '#111111',
    accentColor: '#D97706',
    headingFont: 'Montserrat',
    bodyFont: 'Montserrat',
    fontFamily: 'Montserrat',
    backgroundStyle: 'clean-white',
    cardStyle: 'elevated',
    heroBannerText: 'Celebrating Art, Literature, Eloquence & Cultural Heritage',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Chief Festival Admin'
  });

  // 15. GREEN ROOM ASSIGNMENTS & COUNTERS
  console.log('🚪 Seeding Green Room Assignments & Counters...');
  const grAssignments = [
    {
      id: 'comp-1_reg-01',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      registrationId: 'reg-01',
      codeLetter: 'A',
      codeIndex: 0,
      participantId: 'part-101',
      participantName: 'Ameen Farhan K.P.',
      teamId: 'team-1',
      teamName: 'Al-Shamama',
      bib: 'BIB-101',
      status: 'COMPLETED',
      type: 'SOLO',
      checkedInAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
      checkedInBy: 'admin-01',
      createdAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 3600 * 1000).toISOString()
    },
    {
      id: 'comp-1_reg-02',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      registrationId: 'reg-02',
      codeLetter: 'B',
      codeIndex: 1,
      participantId: 'part-102',
      participantName: 'Muhammad Sinan T.',
      teamId: 'team-2',
      teamName: 'An-Nawa',
      bib: 'BIB-102',
      status: 'COMPLETED',
      type: 'SOLO',
      checkedInAt: new Date(now.getTime() - 3.8 * 3600 * 1000).toISOString(),
      checkedInBy: 'admin-01',
      createdAt: new Date(now.getTime() - 3.8 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3.8 * 3600 * 1000).toISOString()
    },
    {
      id: 'comp-1_reg-03',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      registrationId: 'reg-03',
      codeLetter: 'C',
      codeIndex: 2,
      participantId: 'part-103',
      participantName: 'Bilal Shahid',
      teamId: 'team-3',
      teamName: 'Al-Ishraq',
      bib: 'BIB-103',
      status: 'COMPLETED',
      type: 'SOLO',
      checkedInAt: new Date(now.getTime() - 3.6 * 3600 * 1000).toISOString(),
      checkedInBy: 'admin-01',
      createdAt: new Date(now.getTime() - 3.6 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3.6 * 3600 * 1000).toISOString()
    },
    {
      id: 'comp-1_reg-04',
      competitionId: 'comp-1',
      competitionName: 'Qur\'an Recitation (Murattal)',
      registrationId: 'reg-04',
      codeLetter: 'D',
      codeIndex: 3,
      participantId: 'part-104',
      participantName: 'Rayyan Abdulla',
      teamId: 'team-4',
      teamName: 'Ar-Rawda',
      bib: 'BIB-104',
      status: 'COMPLETED',
      type: 'SOLO',
      checkedInAt: new Date(now.getTime() - 3.4 * 3600 * 1000).toISOString(),
      checkedInBy: 'admin-01',
      createdAt: new Date(now.getTime() - 3.4 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3.4 * 3600 * 1000).toISOString()
    },
    {
      id: 'comp-2_reg-05',
      competitionId: 'comp-2',
      competitionName: 'Elocution (Malayalam)',
      registrationId: 'reg-05',
      codeLetter: 'A',
      codeIndex: 0,
      participantId: 'part-201',
      participantName: 'Zayan Ahmed',
      teamId: 'team-1',
      teamName: 'Al-Shamama',
      bib: 'BIB-201',
      status: 'CHECKED_IN',
      type: 'SOLO',
      checkedInAt: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
      checkedInBy: 'admin-01',
      createdAt: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 3600 * 1000).toISOString()
    },
    {
      id: 'comp-2_reg-06',
      competitionId: 'comp-2',
      competitionName: 'Elocution (Malayalam)',
      registrationId: 'reg-06',
      codeLetter: 'B',
      codeIndex: 1,
      participantId: 'part-202',
      participantName: 'Hanan Mustafa',
      teamId: 'team-2',
      teamName: 'An-Nawa',
      bib: 'BIB-202',
      status: 'CHECKED_IN',
      type: 'SOLO',
      checkedInAt: new Date(now.getTime() - 0.8 * 3600 * 1000).toISOString(),
      checkedInBy: 'admin-01',
      createdAt: new Date(now.getTime() - 0.8 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 0.8 * 3600 * 1000).toISOString()
    }
  ];

  for (const gra of grAssignments) {
    await db.collection('greenRoomAssignments').doc(gra.id).set(gra);
  }

  await db.collection('greenRoomCounters').doc('comp-1').set({
    competitionId: 'comp-1',
    assignedCodes: ['A', 'B', 'C', 'D'],
    totalCheckedIn: 4,
    lastAssignedCode: 'D',
    updatedAt: now.toISOString()
  });

  await db.collection('greenRoomCounters').doc('comp-2').set({
    competitionId: 'comp-2',
    assignedCodes: ['A', 'B'],
    totalCheckedIn: 2,
    lastAssignedCode: 'B',
    updatedAt: now.toISOString()
  });

  console.log('✅ Demo Data Seeding Completed Successfully! All 18 collections populated.');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
