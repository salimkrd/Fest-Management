import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';

async function checkIndexes() {
  const serviceAccountPath = 'C:/Users/Admin/.credentials/inspirath-d6778-firebase-adminsdk.json';
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: 'inspirath-d6778'
  }, 'index-check-app');

  const credential = app.options.credential;
  if (!credential) {
    throw new Error('Credential not found');
  }

  const token = await credential.getAccessToken();
  const url = 'https://firestore.googleapis.com/v1/projects/inspirath-d6778/databases/(default)/collectionGroups/-/indexes';

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });

  const data = await res.json();
  console.log('--- FIRESTORE COMPOSITE INDEXES ---');
  if (data.indexes) {
    console.log(`Total Indexes: ${data.indexes.length}`);
    data.indexes.forEach((idx: any, i: number) => {
      const colId = idx.name.split('/collectionGroups/')[1].split('/indexes/')[0];
      const fields = idx.fields.map((f: any) => `${f.fieldPath} (${f.order || f.arrayConfig})`).join(', ');
      console.log(`[Index ${i + 1}] Collection: ${colId} | State: ${idx.state} | Fields: ${fields}`);
    });
  } else {
    console.log('No indexes returned:', data);
  }
}

checkIndexes().catch(console.error);
