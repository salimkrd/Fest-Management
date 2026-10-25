/**
 * Firebase Admin SDK Initialization (Trusted Server Operations)
 * Used exclusively inside Server Actions, Route Handlers, and Cloud Functions.
 * 
 * Never exposed to the browser.
 * Relies on FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 * or GOOGLE_APPLICATION_CREDENTIALS.
 */

import { initializeApp, getApps, cert, applicationDefault, App, deleteApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';
import type { Credential, GoogleOAuthAccessToken } from 'firebase-admin/app';
import { IdentityPoolClient, BaseExternalAccountClient } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const ALLOWED_WIF_BRANCH = 'feature/participant-id-dob-portal';
export const STAGING_PROJECT_ID = 'inspirath-staging';
export const PRODUCTION_PROJECT_ID = 'inspirath-d6778';
export const VERCEL_PROJECT_ID = 'prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y';

let adminApp: App | null = null;

/**
 * Returns the file path used to store the short-lived Vercel OIDC subject token
 * for Google Cloud Security Token Service (STS) exchange.
 */
export function getWorkloadIdentityTokenFilePath(): string {
  if (process.env.VERCEL_OIDC_TOKEN_FILE?.trim() && fs.existsSync(/*turbopackIgnore: true*/ process.env.VERCEL_OIDC_TOKEN_FILE.trim())) {
    return process.env.VERCEL_OIDC_TOKEN_FILE.trim();
  }
  return path.join(os.tmpdir(), 'inspirath-staging-oidc-token.jwt');
}

/**
 * Returns the file path where the Google Cloud External Account ADC configuration
 * is written in the local serverless temporary storage.
 */
export function getWorkloadIdentityConfigFilePath(): string {
  return path.join(os.tmpdir(), 'inspirath-staging-wif-adc.json');
}

/**
 * Formats the normalized Google Cloud STS audience URI.
 */
export function getWorkloadIdentityAudience(): string {
  if (process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE?.trim()) {
    return process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE.trim();
  }
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER!.trim();
  return provider.startsWith('//') ? provider : `//iam.googleapis.com/${provider.replace(/^\/+/, '')}`;
}

/**
 * Generates the Google Cloud External Account credential configuration JSON
 * adhering to Google Application Default Credentials (ADC) format for Workload Identity Federation.
 */
export function generateWorkloadIdentityConfig(tokenFilePath: string): Record<string, any> {
  if (process.env.GCP_WORKLOAD_IDENTITY_CONFIG?.trim()) {
    let rawConfig = process.env.GCP_WORKLOAD_IDENTITY_CONFIG.trim();
    if ((rawConfig.startsWith('"') && rawConfig.endsWith('"')) || (rawConfig.startsWith("'") && rawConfig.endsWith("'"))) {
      rawConfig = rawConfig.slice(1, -1);
    }
    const parsed = JSON.parse(rawConfig);
    if (!parsed.credential_source || !parsed.credential_source.file) {
      parsed.credential_source = { file: tokenFilePath };
    }
    return parsed;
  }

  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER!.trim();
  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL!.trim();
  const impersonationUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`;
  const tokenUrl = process.env.GCP_WORKLOAD_IDENTITY_STS_URL?.trim() || 'https://sts.googleapis.com/v1/token';

  return {
    type: 'external_account',
    audience: getWorkloadIdentityAudience(),
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: tokenUrl,
    service_account_impersonation_url: impersonationUrl,
    credential_source: {
      file: tokenFilePath
    }
  };
}

/**
 * Sets up Google Application Default Credentials (ADC) backed by Workload Identity Federation.
 * Writes the ADC configuration file and initial token to secure temporary storage, then sets
 * GOOGLE_APPLICATION_CREDENTIALS so that Firebase Admin's applicationDefault() and Cloud Firestore
 * recognize and accept the credentials natively.
 */
export function setupWorkloadIdentityAdc(targetProjectId: string): string {
  validateWorkloadIdentityScope(targetProjectId);

  const tokenFilePath = getWorkloadIdentityTokenFilePath();

  // If a subject token exists synchronously in the environment, ensure it is written to the file
  const envToken = process.env.GCP_WORKLOAD_IDENTITY_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim();
  if (envToken) {
    try {
      fs.writeFileSync(tokenFilePath, envToken, { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
      console.warn('[Firebase Admin WIF] Failed to write initial token file:', err);
    }
  } else if (!fs.existsSync(/*turbopackIgnore: true*/ tokenFilePath)) {
    try {
      fs.writeFileSync(tokenFilePath, '', { encoding: 'utf8', mode: 0o600 });
    } catch {
      // Ignore initial touch errors in restrictive test runners
    }
  }

  const config = generateWorkloadIdentityConfig(tokenFilePath);
  const configFilePath = getWorkloadIdentityConfigFilePath();
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = configFilePath;
  } catch (err) {
    console.warn('[Firebase Admin WIF] Failed to write ADC config file:', err);
  }

  return configFilePath;
}

/**
 * Adapter implementing Firebase Admin's Credential interface using google-auth-library's
 * IdentityPoolClient / BaseExternalAccountClient. Provided for programmatic and test usage.
 */
export class WorkloadIdentityCredential implements Credential {
  constructor(private client: BaseExternalAccountClient | IdentityPoolClient) {}

  async getAccessToken(): Promise<GoogleOAuthAccessToken> {
    const response = await this.client.getAccessToken();
    const token = response.token;
    if (!token) {
      throw new Error(
        '[Firebase Admin Workload Identity] Failed to acquire access token: STS/impersonation response did not return a valid token.'
      );
    }
    // Calculate token expiry in seconds from cachedAccessToken or default to 1 hour
    const expiryDate = (this.client as any).cachedAccessToken?.expiry_date;
    const expiresIn = expiryDate
      ? Math.max(60, Math.floor((expiryDate - Date.now()) / 1000))
      : 3600;

    return {
      access_token: token,
      expires_in: expiresIn,
    };
  }
}

/**
 * Resolves the Vercel OIDC JWT token used as the subject token for GCP STS exchange.
 * 1. Checks explicit GCP_WORKLOAD_IDENTITY_TOKEN override (for tests/scripts).
 * 2. Uses official @vercel/oidc integration to obtain token from request context (x-vercel-oidc-token)
 *    or rotating token file, with proper token refresh behavior.
 * 3. Falls back to VERCEL_OIDC_TOKEN or VERCEL_OIDC_TOKEN_FILE if outside Vercel request context.
 */
export async function resolveOidcSubjectToken(): Promise<string | null> {
  // 1. Explicit override token (useful for manual scripting, CI testing, or offline emulation)
  if (process.env.GCP_WORKLOAD_IDENTITY_TOKEN?.trim()) {
    return process.env.GCP_WORKLOAD_IDENTITY_TOKEN.trim();
  }

  // 2. Official @vercel/oidc integration: retrieves token from request context (x-vercel-oidc-token),
  // rotating token file, and handles token refresh dynamically
  try {
    const { getVercelOidcToken } = await import('@vercel/oidc');
    const token = await getVercelOidcToken({
      expirationBufferMs: 5 * 60 * 1000 // refresh if expiring within 5 minutes
    });
    if (token?.trim()) {
      return token.trim();
    }
  } catch {
    // In local tests or fallback environments where Vercel request context is not present, fall through
  }

  // 3. Fallback: Vercel standard OIDC token environment variable
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) {
    return process.env.VERCEL_OIDC_TOKEN.trim();
  }

  // 4. Fallback: Vercel OIDC token file path
  if (process.env.VERCEL_OIDC_TOKEN_FILE?.trim()) {
    try {
      const filePath = process.env.VERCEL_OIDC_TOKEN_FILE.trim();
      if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    } catch (err) {
      console.warn('[Firebase Admin WIF] Unable to read subject token from VERCEL_OIDC_TOKEN_FILE:', err);
    }
  }

  return null;
}

/**
 * Synchronizes the latest Vercel OIDC token into the local file designated for Google Cloud STS exchange.
 * In Vercel serverless environments, this pulls the current request's token from @vercel/oidc
 * and updates the token file before Firestore operations execute.
 */
export async function syncWorkloadIdentityToken(): Promise<string | null> {
  if (!isWorkloadIdentityConfigured()) {
    return null;
  }

  try {
    const targetProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || STAGING_PROJECT_ID;
    const token = await resolveOidcSubjectToken();
    if (token) {
      const tokenFilePath = getWorkloadIdentityTokenFilePath();
      fs.writeFileSync(tokenFilePath, token, { encoding: 'utf8', mode: 0o600 });
      setupWorkloadIdentityAdc(targetProjectId);
      return token;
    }
  } catch (err) {
    console.warn('[Firebase Admin WIF] Failed to synchronize OIDC token:', err);
  }

  return null;
}

/**
 * Determines whether Workload Identity Federation is configured in the environment.
 */
export function isWorkloadIdentityConfigured(): boolean {
  if (process.env.GCP_WORKLOAD_IDENTITY_CONFIG?.trim()) {
    return true;
  }
  return Boolean(
    process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim() &&
    process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
  );
}

/**
 * STRICT FAIL-CLOSED VALIDATION FOR WORKLOAD IDENTITY FEDERATION:
 * 1. Prohibits WIF from ever connecting to the production project (inspirath-d6778).
 * 2. Prohibits WIF from being activated in Vercel production deployment.
 * 3. In Vercel preview environments, restricts access strictly to the Participant Portal branch.
 * 4. Validates that the Vercel project ID matches prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y.
 */
export function validateWorkloadIdentityScope(targetProjectId: string): void {
  // 1. Fail-closed: Never allow Workload Identity to connect to production
  if (targetProjectId === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `[FAIL-CLOSED SAFETY] Workload Identity Federation cannot target production project "${PRODUCTION_PROJECT_ID}". ` +
      `Workload Identity is exclusively authorized for staging/preview environments (e.g. "${STAGING_PROJECT_ID}").`
    );
  }

  // 2. Fail-closed: Never run in Vercel production deployment
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') {
    throw new Error(
      `[FAIL-CLOSED SAFETY] Workload Identity Federation is restricted to staging/preview environments and cannot run in production deployments.`
    );
  }

  // 3. Fail-closed: Restrict federated access to the Participant Portal preview branch in Vercel Preview
  const allowedBranch = process.env.GCP_WORKLOAD_IDENTITY_ALLOWED_BRANCH?.trim() || ALLOWED_WIF_BRANCH;
  const currentBranch = process.env.VERCEL_GIT_COMMIT_REF?.trim();

  if (vercelEnv === 'preview' && currentBranch && currentBranch !== allowedBranch) {
    throw new Error(
      `[FAIL-CLOSED SAFETY] Workload Identity Federation is restricted to branch "${allowedBranch}" in Vercel Preview, ` +
      `but current branch is "${currentBranch}". Access to staging credentials denied.`
    );
  }

  // 4. Fail-closed: Restrict federated access to the authorized Vercel Project ID
  const expectedProjectId = process.env.GCP_WORKLOAD_IDENTITY_VERCEL_PROJECT_ID?.trim() || VERCEL_PROJECT_ID;
  const currentVercelProjectId = process.env.VERCEL_PROJECT_ID?.trim();

  if (currentVercelProjectId && currentVercelProjectId !== expectedProjectId) {
    throw new Error(
      `[FAIL-CLOSED SAFETY] Workload Identity Federation is restricted to Vercel Project ID "${expectedProjectId}", ` +
      `but current environment VERCEL_PROJECT_ID is "${currentVercelProjectId}". Access denied.`
    );
  }
}

/**
 * Builds the IdentityPoolClient configured for exchanging Vercel OIDC tokens with GCP STS
 * and impersonating the staging service account.
 */
export function buildWorkloadIdentityClient(targetProjectId: string): IdentityPoolClient {
  validateWorkloadIdentityScope(targetProjectId);

  // Case 1: Full GCP credential configuration JSON string
  if (process.env.GCP_WORKLOAD_IDENTITY_CONFIG?.trim()) {
    let rawConfig = process.env.GCP_WORKLOAD_IDENTITY_CONFIG.trim();
    if ((rawConfig.startsWith('"') && rawConfig.endsWith('"')) || (rawConfig.startsWith("'") && rawConfig.endsWith("'"))) {
      rawConfig = rawConfig.slice(1, -1);
    }
    const parsed = JSON.parse(rawConfig);
    if (!parsed.subject_token_supplier && (!parsed.credential_source || !parsed.credential_source.file)) {
      parsed.subject_token_supplier = {
        getSubjectToken: async () => {
          const token = await resolveOidcSubjectToken();
          if (!token) {
            throw new Error(
              '[Firebase Admin Workload Identity] OIDC subject token not found. ' +
              'Ensure @vercel/oidc is configured, or VERCEL_OIDC_TOKEN / GCP_WORKLOAD_IDENTITY_TOKEN is present in the environment.'
            );
          }
          return token;
        }
      };
    }
    return new IdentityPoolClient(parsed);
  }

  // Case 2: Discrete environment variables
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER!.trim();
  let audience = process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE?.trim();
  if (!audience) {
    audience = provider.startsWith('//') ? provider : `//iam.googleapis.com/${provider.replace(/^\/+/, '')}`;
  }

  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL!.trim();
  const impersonationUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`;
  const tokenUrl = process.env.GCP_WORKLOAD_IDENTITY_STS_URL?.trim() || 'https://sts.googleapis.com/v1/token';

  return new IdentityPoolClient({
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: tokenUrl,
    service_account_impersonation_url: impersonationUrl,
    subject_token_supplier: {
      getSubjectToken: async () => {
        const token = await resolveOidcSubjectToken();
        if (!token) {
          throw new Error(
            '[Firebase Admin Workload Identity] OIDC subject token not found. ' +
            'Ensure @vercel/oidc is configured, or VERCEL_OIDC_TOKEN / GCP_WORKLOAD_IDENTITY_TOKEN is present in the environment.'
          );
        }
        return token;
      }
    }
  });
}

/**
 * Creates a WorkloadIdentityCredential for testing and programmatic token acquisition.
 */
export function createWorkloadIdentityCredential(targetProjectId: string): WorkloadIdentityCredential {
  const client = buildWorkloadIdentityClient(targetProjectId);
  return new WorkloadIdentityCredential(client);
}

export function getAdminApp(): App | null {
  const apps = getApps();
  const defaultApp = apps.find(a => a.name === '[DEFAULT]') || null;
  if (defaultApp) {
    return defaultApp;
  }

  const isTestEnvironment = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // STRICT RECURRENCE PREVENTION & FAIL-CLOSED SAFETY GUARD:
  // Automated test execution must NEVER connect to the production project (inspirath-d6778).
  // All automated test runs must target the local Firebase Emulator or a designated non-production project.
  if (isTestEnvironment && projectId === 'inspirath-d6778' && !process.env.ALLOW_PROD_TEST_READONLY) {
    throw new Error(
      `[FAIL-CLOSED SAFETY] Automated tests are strictly prohibited from connecting to production project "inspirath-d6778". ` +
      `Tests must use the local Firebase Emulator (demo-sahithyolsav-2025) or an explicitly designated non-production environment.`
    );
  }

  // 1. Emulator vs Live Project Isolation (PRIORITIZED FIRST)
  // When emulator is configured, NEVER fall back to live production credentials.
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const isEmulator = !isProduction && Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
  );

  if (isEmulator) {
    try {
      adminApp = initializeApp({
        projectId: (projectId && projectId !== 'inspirath-d6778') ? projectId : 'demo-sahithyolsav-2025'
      });
      return adminApp;
    } catch (err) {
      return null;
    }
  }

  // If in test environment and emulator is NOT active, FAIL CLOSED if credentials exist or return null
  if (isTestEnvironment && !process.env.ALLOW_PROD_TEST_READONLY && !process.env.ALLOW_STAGING_WIF_TEST) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      throw new Error(
        `[FAIL-CLOSED SAFETY] Test execution cannot fall back to live production credentials when emulator is not active.`
      );
    }
    return null;
  }

  // 2. Check for GOOGLE_APPLICATION_CREDENTIALS (Preferred secure local credential-file mechanism for live production)
  // Ensures existing production credentials files take precedence over Workload Identity Federation
  const generatedWifConfigPath = getWorkloadIdentityConfigFilePath();
  const isCustomProductionGac = process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS !== generatedWifConfigPath;

  if (isCustomProductionGac) {
    try {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: projectId || 'inspirath-d6778',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Error initializing with GOOGLE_APPLICATION_CREDENTIALS:', err);
    }
  }

  // 3. Check for service account JSON string (Optimized for Vercel / Cloud serverless deployment)
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    try {
      let rawSa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON.trim();
      if ((rawSa.startsWith('"') && rawSa.endsWith('"')) || (rawSa.startsWith("'") && rawSa.endsWith("'"))) {
        rawSa = rawSa.slice(1, -1);
      }
      if (!rawSa.startsWith('{') && /^[A-Za-z0-9+/=]+$/.test(rawSa)) {
        rawSa = Buffer.from(rawSa, 'base64').toString('utf-8');
      }
      const sa = JSON.parse(rawSa);
      adminApp = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId || 'inspirath-d6778',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Error initializing with FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:', err);
    }
  }

  // 4. Check for discrete environment variables (Alternative cert credential mechanism)
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId: projectId.trim(),
          clientEmail,
          privateKey
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Error initializing with service account cert:', err);
    }
  }

  // 5. Workload Identity Federation via Application Default Credentials (ADC)
  // Backed by an external-account configuration pointing to the Vercel OIDC token file.
  // Using applicationDefault() is strictly required by Cloud Firestore (getFirestore) to accept credentials.
  if (isWorkloadIdentityConfigured()) {
    try {
      const targetProjectId = projectId || STAGING_PROJECT_ID;
      validateWorkloadIdentityScope(targetProjectId);
      setupWorkloadIdentityAdc(targetProjectId);
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: targetProjectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
      return adminApp;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[FAIL-CLOSED SAFETY]')) {
        throw err;
      }
      console.error('[Firebase Admin] Error initializing with Workload Identity Federation ADC:', err);
    }
  }

  // In live production mode, strictly require certified service account credentials
  console.warn(
    `[Firebase Admin] Live Firebase credentials not configured for project "${projectId}". Server-side operations require service account credentials.`
  );
  return null;
}

export async function resetAdminApp(): Promise<void> {
  const apps = getApps();
  for (const app of apps) {
    try {
      await deleteApp(app);
    } catch {
      // ignore deletion errors
    }
  }
  adminApp = null;
  const generatedConfig = getWorkloadIdentityConfigFilePath();
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS === generatedConfig) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Ignore error if settings have already been locked/initialized
  }
  return db;
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export function getAdminStorage(): Storage | null {
  const app = getAdminApp();
  return app ? getStorage(app) : null;
}

