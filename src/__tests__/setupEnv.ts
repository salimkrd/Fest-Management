import fs from 'fs';
import path from 'path';

// Load .env.local for basic local config
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

// Strict Safety Guard: Test suites must ALWAYS execute against the local emulator,
// never against the production cloud project.
(process.env as any).NODE_ENV = 'test';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIREBASE_ADMIN_PROJECT_ID = 'demo-sahithyolsav-2025';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-sahithyolsav-2025';

// Clear live service account in test runner to prevent accidental live connection
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

// Test environment bootstrap secret default
process.env.ADMIN_BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET || 'TestBootstrapSecret123!';
