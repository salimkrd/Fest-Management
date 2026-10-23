import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { hashSecret } from '../src/domain/judgeAuth';

async function seedJryCode() {
  const code = 'JRY-LL4X';
  const salt = 'salt16bytesrandom';
  const secretHash = await hashSecret('jury1234', salt);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

  const assignment = {
    id: 'asgn-jry-ll4x',
    judgeName: 'Official Stage Juror',
    judgePhone: '+91 98470 00000',
    competitionId: 'cmp-1',
    competitionCode: 'CMP-01',
    competitionName: 'Extempore Speech (English)',
    categoryName: 'Senior',
    type: 'SOLO',
    stageName: 'Main Auditorium',
    accessCode: code,
    secretHash,
    salt,
    issuedAt: now.toISOString(),
    expiresAt,
    expiresAtMs: new Date(expiresAt).getTime(),
    revoked: false,
    status: 'ACTIVE'
  };

  // 1. Seed emulator
  try {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    const emuApp = admin.initializeApp({ projectId: 'demo-sahithyolsav-2025' }, 'emu-seed-jry');
    const emuDb = emuApp.firestore();
    await emuDb.collection('judgeAssignments').doc(assignment.id).set(assignment, { merge: true });
    console.log(`[Emulator] Seeded ${code} to judgeAssignments/${assignment.id}`);
  } catch (e: any) {
    console.log('[Emulator] Seed warning:', e.message);
  }

  // 2. Seed production
  try {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const credPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
    if (fs.existsSync(credPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      const prodApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'inspirath-d6778' }, 'prod-seed-jry');
      const prodDb = prodApp.firestore();
      await prodDb.collection('judgeAssignments').doc(assignment.id).set(assignment, { merge: true });
      console.log(`[Production] Seeded ${code} to judgeAssignments/${assignment.id}`);
    }
  } catch (e: any) {
    console.log('[Production] Seed warning:', e.message);
  }
}

seedJryCode().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
