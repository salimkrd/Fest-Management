import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

async function verifyEmailAuth() {
  const clientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'inspirath-d6778.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'inspirath-d6778',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'inspirath-d6778.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
  };

  const app = initializeApp(clientConfig, 'probe-app');
  const auth = getAuth(app);

  console.log('Testing Email/Password sign-in provider status on inspirath-d6778...');
  try {
    await signInWithEmailAndPassword(auth, 'probe-check-provider@inspirath-d6778.test', 'WrongPass123!');
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    console.log(`Received Auth response code: ${code}`);
    if (code === 'auth/operation-not-allowed') {
      console.error('CRITICAL: Email/Password Authentication is DISABLED in Firebase Console!');
      process.exit(1);
    } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
      console.log('SUCCESS: Email/Password Authentication provider is ENABLED on inspirath-d6778.');
    } else {
      console.log(`Auth response: ${code} - ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

verifyEmailAuth().catch(console.error);
