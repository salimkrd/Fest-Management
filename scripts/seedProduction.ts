import * as admin from 'firebase-admin';
import * as fs from 'fs';

async function seedCategories() {
  if (process.env.CONFIRM_PRODUCTION_SEED !== 'YES_I_WANT_TO_SEED_PRODUCTION') {
    console.error('[SAFETY ABORT] seedProduction requires explicit CONFIRM_PRODUCTION_SEED=YES_I_WANT_TO_SEED_PRODUCTION environment variable.');
    process.exit(1);
  }

  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = admin.apps.find(a => a?.name === 'prod-seed') || admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'inspirath-d6778'
  }, 'prod-seed');

  const db = app.firestore();
  console.log('Seeding initial categories to inspirath-d6778...');

  const initialCategories = [
    { id: 'cat-1', name: 'Sub Junior', code: 'CAT-SJ', eligibility: 'Class 5 to 7', ageRange: '10 - 12 Years', classRange: 'Std 5 - 7', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
    { id: 'cat-2', name: 'Junior', code: 'CAT-JR', eligibility: 'Class 8 to 10', ageRange: '13 - 15 Years', classRange: 'Std 8 - 10', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
    { id: 'cat-3', name: 'Senior', code: 'CAT-SR', eligibility: 'Class 11 to 12', ageRange: '16 - 18 Years', classRange: 'Std 11 - 12', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' },
    { id: 'cat-4', name: 'General', code: 'CAT-GEN', eligibility: 'All Eligible Students', ageRange: 'Open Tier', classRange: 'Campus Wide', enrolledCount: 0, competitionsCount: 0, status: 'ACTIVE' }
  ];

  for (const cat of initialCategories) {
    await db.collection('categories').doc(cat.id).set(cat, { merge: true });
    console.log(`Seeded category ${cat.id} (${cat.name})`);
  }

  // Also seed initial canonical competitions if competitions is empty
  const compSnap = await db.collection('competitions').get();
  if (compSnap.empty) {
    const initialCompetitions = [
      {
        id: 'cmp-1',
        code: 'CMP-01',
        name: 'Extempore Speech (English)',
        categoryId: 'cat-3',
        categoryName: 'Senior',
        type: 'SOLO',
        entriesCount: 0,
        stageId: 'stg-1',
        stageName: 'Main Auditorium',
        assignedJudges: [],
        status: 'PUBLISHED',
        date: '2025-11-14',
        timeSlot: '09:30 AM - 11:30 AM',
        durationMinutes: 120,
        maxEntriesPerTeam: 2,
        criteria: [
          { id: 'crt-1', name: 'Clarity & Articulation', maxMarks: 30 },
          { id: 'crt-2', name: 'Content & Vocabulary', maxMarks: 40 },
          { id: 'crt-3', name: 'Poise & Confidence', maxMarks: 30 }
        ]
      },
      {
        id: 'cmp-2',
        code: 'CMP-02',
        name: 'Quran Recitation (Tajweed)',
        categoryId: 'cat-2',
        categoryName: 'Junior',
        type: 'SOLO',
        entriesCount: 0,
        stageId: 'stg-2',
        stageName: 'Seminar Hall A',
        assignedJudges: [],
        status: 'PUBLISHED',
        date: '2025-11-14',
        timeSlot: '11:45 AM - 01:45 PM',
        durationMinutes: 120,
        maxEntriesPerTeam: 2,
        criteria: [
          { id: 'crt-4', name: 'Tajweed Rules & Makharidj', maxMarks: 40 },
          { id: 'crt-5', name: 'Voice & Modulation', maxMarks: 30 },
          { id: 'crt-6', name: 'Tahfeez & Accuracy', maxMarks: 30 }
        ]
      },
      {
        id: 'cmp-3',
        code: 'CMP-03',
        name: 'Duffmuttu (Choreographed)',
        categoryId: 'cat-4',
        categoryName: 'General',
        type: 'GROUP',
        entriesCount: 0,
        stageId: 'stg-3',
        stageName: 'Open Amphitheater',
        assignedJudges: [],
        status: 'PUBLISHED',
        date: '2025-11-14',
        timeSlot: '02:30 PM - 05:00 PM',
        durationMinutes: 150,
        maxEntriesPerTeam: 1,
        criteria: [
          { id: 'crt-7', name: 'Rhythm & Beats', maxMarks: 35 },
          { id: 'crt-8', name: 'Choreography & Steps', maxMarks: 35 },
          { id: 'crt-9', name: 'Vocal Harmony', maxMarks: 30 }
        ]
      },
      {
        id: 'cmp-4',
        code: 'CMP-04',
        name: 'Mappilappattu (Solo)',
        categoryId: 'cat-1',
        categoryName: 'Sub Junior',
        type: 'SOLO',
        entriesCount: 0,
        stageId: 'stg-4',
        stageName: 'Green Lawn Stage',
        assignedJudges: [],
        status: 'PUBLISHED',
        date: '2025-11-14',
        timeSlot: '03:00 PM - 04:30 PM',
        durationMinutes: 90,
        maxEntriesPerTeam: 2,
        criteria: [
          { id: 'crt-10', name: 'Sur & Melody', maxMarks: 40 },
          { id: 'crt-11', name: 'Diction & Pronunciation', maxMarks: 30 },
          { id: 'crt-12', name: 'Stage Presence', maxMarks: 30 }
        ]
      }
    ];

    for (const cmp of initialCompetitions) {
      await db.collection('competitions').doc(cmp.id).set(cmp, { merge: true });
      console.log(`Seeded competition ${cmp.id} (${cmp.name})`);
    }
  }

  console.log('Seeding completed successfully!');
}

seedCategories().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
