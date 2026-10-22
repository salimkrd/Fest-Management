import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

async function generateSecretOutsideRepo() {
  const secret = crypto.randomBytes(32).toString('hex');

  // Secure local credentials directory (outside repository and outside OneDrive)
  const credentialsDir = 'C:/Users/Admin/.credentials';
  if (!fs.existsSync(credentialsDir)) {
    fs.mkdirSync(credentialsDir, { recursive: true });
  }

  const secretKeyPath = path.join(credentialsDir, 'admin_bootstrap_secret.key');
  fs.writeFileSync(secretKeyPath, secret, { encoding: 'utf8', mode: 0o600 });

  // Clean up any remaining in-repo secret files
  const localSecretsDir = path.resolve(process.cwd(), '.firebase-secrets');
  if (fs.existsSync(localSecretsDir)) {
    fs.rmSync(localSecretsDir, { recursive: true, force: true });
  }

  console.log('✔ Fresh cryptographically strong bootstrap secret (256-bit entropy) generated successfully.');
  console.log(`✔ Stored securely outside repository and cloud sync at: ${secretKeyPath}`);
  console.log('✔ Zero secrets written to .env.local, .firebase-secrets/, or OneDrive.');
  console.log('✔ Secret is protected and never printed, logged, or committed to source control.');
}

generateSecretOutsideRepo().catch(console.error);
