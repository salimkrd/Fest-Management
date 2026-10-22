import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';

async function checkIdentityToolkitEndpoints() {
  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778'
  }, 'id-toolkit-check');

  const tokenObj = await (app.options.credential as any).getAccessToken();
  const token = tokenObj.access_token;

  const endpoints = [
    'https://identitytoolkit.googleapis.com/admin/v2/projects/inspirath-d6778/config',
    'https://identitytoolkit.googleapis.com/v2/projects/inspirath-d6778/config',
    'https://identitytoolkit.googleapis.com/admin/v2/projects/297712280214/config',
    'https://identitytoolkit.googleapis.com/v2/projects/297712280214/defaultSupportedIdpConfigs',
    'https://identitytoolkit.googleapis.com/admin/v2/projects/inspirath-d6778/defaultSupportedIdpConfigs'
  ];

  for (const url of endpoints) {
    console.log(`\nTesting endpoint: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      console.log(`Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log('Response JSON:', JSON.stringify(json, null, 2));
      } catch {
        console.log('Response text (first 200 chars):', text.slice(0, 200));
      }
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }
}

checkIdentityToolkitEndpoints().catch(console.error);
