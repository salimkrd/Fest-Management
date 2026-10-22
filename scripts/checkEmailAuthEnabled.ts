import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';

async function checkAuthConfig() {
  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778'
  }, 'auth-config-check');

  const auth = getAuth(app);

  try {
    const projectConfig = await (auth as any).projectConfigManager().getProjectConfig();
    console.log('Project Config raw:', JSON.stringify(projectConfig, null, 2));
  } catch (err: any) {
    console.log('projectConfigManager() error:', err.message);
  }

  // Also query Identity Toolkit config endpoint directly with OAuth2 token
  try {
    const token = await (app.options.credential as any).getAccessToken();
    const res = await fetch('https://identitytoolkit.googleapis.com/v1/projects/inspirath-d6778/config', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`
      }
    });
    const data = await res.json();
    console.log('Identity Toolkit Config Endpoint:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.log('Fetch error:', err.message);
  }
}

checkAuthConfig().catch(console.error);
