import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import * as fs from 'fs';
import * as path from 'path';

async function backup() {
  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account not found:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778',
    storageBucket: 'inspirath-d6778.firebasestorage.app'
  }, 'backup-app');

  const securityRules = getSecurityRules(app);

  const backupDir = path.resolve(process.cwd(), 'backups/production_pre_checkpoint_1');
  fs.mkdirSync(backupDir, { recursive: true });

  console.log('Fetching live Firestore rules from inspirath-d6778...');
  try {
    const firestoreRuleset = await securityRules.getFirestoreRuleset();
    const firestoreSource = firestoreRuleset.source[0]?.content || '';
    fs.writeFileSync(path.join(backupDir, 'firestore.rules.bak'), firestoreSource, 'utf8');
    console.log('Successfully backed up live Firestore rules to backups/production_pre_checkpoint_1/firestore.rules.bak');
    console.log(`Live Firestore Ruleset Name: ${firestoreRuleset.name}, Created: ${firestoreRuleset.createTime}`);
  } catch (err: any) {
    console.warn('Could not fetch Firestore ruleset via Admin API:', err?.message);
    fs.writeFileSync(path.join(backupDir, 'firestore.rules.bak'), '// No previous custom ruleset found or error fetching\n', 'utf8');
  }

  console.log('Fetching live Storage rules from inspirath-d6778...');
  try {
    const storageRuleset = await securityRules.getStorageRuleset();
    const storageSource = storageRuleset.source[0]?.content || '';
    fs.writeFileSync(path.join(backupDir, 'storage.rules.bak'), storageSource, 'utf8');
    console.log('Successfully backed up live Storage rules to backups/production_pre_checkpoint_1/storage.rules.bak');
    console.log(`Live Storage Ruleset Name: ${storageRuleset.name}, Created: ${storageRuleset.createTime}`);
  } catch (err: any) {
    console.warn('Could not fetch Storage ruleset via Admin API:', err?.message);
    fs.writeFileSync(path.join(backupDir, 'storage.rules.bak'), '// No previous custom ruleset found or error fetching\n', 'utf8');
  }

  console.log('Backup process completed.');
}

backup().catch(console.error);
