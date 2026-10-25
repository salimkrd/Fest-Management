import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  WorkloadIdentityCredential,
  resolveOidcSubjectToken,
  isWorkloadIdentityConfigured,
  validateWorkloadIdentityScope,
  buildWorkloadIdentityClient,
  createWorkloadIdentityCredential,
  getAdminApp,
  resetAdminApp,
  ALLOWED_WIF_BRANCH,
  STAGING_PROJECT_ID,
  PRODUCTION_PROJECT_ID,
  VERCEL_PROJECT_ID
} from '@/lib/firebase/admin';

describe('Workload Identity Federation for Firebase Admin', () => {
  const originalEnv = { ...process.env };
  let tempTokenFile: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    await resetAdminApp();
    process.env = { ...originalEnv };
    // Clear credentials to isolate WIF test conditions
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    delete process.env.GCP_WORKLOAD_IDENTITY_CONFIG;
    delete process.env.GCP_WORKLOAD_IDENTITY_PROVIDER;
    delete process.env.GCP_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE;
    delete process.env.GCP_WORKLOAD_IDENTITY_STS_URL;
    delete process.env.GCP_WORKLOAD_IDENTITY_TOKEN;
    delete process.env.GCP_WORKLOAD_IDENTITY_ALLOWED_BRANCH;
    delete process.env.GCP_WORKLOAD_IDENTITY_VERCEL_PROJECT_ID;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN_FILE;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_REF;
    delete process.env.VERCEL_PROJECT_ID;
    delete process.env.ALLOW_STAGING_WIF_TEST;
  });

  afterEach(async () => {
    if (tempTokenFile && fs.existsSync(tempTokenFile)) {
      try {
        fs.unlinkSync(tempTokenFile);
      } catch {
        // ignore cleanup error
      }
      tempTokenFile = null;
    }
    await resetAdminApp();
    process.env = { ...originalEnv };
  });

  describe('resolveOidcSubjectToken', () => {
    it('returns null when no OIDC token environment variables or request headers exist', async () => {
      const token = await resolveOidcSubjectToken();
      expect(token).toBeNull();
    });

    it('prioritizes explicit GCP_WORKLOAD_IDENTITY_TOKEN override over others', async () => {
      process.env.GCP_WORKLOAD_IDENTITY_TOKEN = 'token-from-gcp-wif-override';
      process.env.VERCEL_OIDC_TOKEN = 'token-from-vercel-oidc';
      const token = await resolveOidcSubjectToken();
      expect(token).toBe('token-from-gcp-wif-override');
    });

    it('resolves standard VERCEL_OIDC_TOKEN when override is not set', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      process.env.VERCEL_OIDC_TOKEN = `${header}.${payload}.signature`;

      const token = await resolveOidcSubjectToken();
      expect(token).toBe(`${header}.${payload}.signature`);
    });

    it('resolves token from VERCEL_OIDC_TOKEN_FILE path', async () => {
      tempTokenFile = path.join(os.tmpdir(), `vercel-test-token-${Date.now()}.jwt`);
      fs.writeFileSync(tempTokenFile, 'token-from-file-content\n', 'utf8');
      process.env.VERCEL_OIDC_TOKEN_FILE = tempTokenFile;

      const token = await resolveOidcSubjectToken();
      expect(token).toBe('token-from-file-content');
    });

    it('returns null gracefully if VERCEL_OIDC_TOKEN_FILE does not exist', async () => {
      process.env.VERCEL_OIDC_TOKEN_FILE = path.join(os.tmpdir(), 'non-existent-token-file.jwt');
      const token = await resolveOidcSubjectToken();
      expect(token).toBeNull();
    });
  });

  describe('isWorkloadIdentityConfigured', () => {
    it('returns false when no WIF configuration is present', () => {
      expect(isWorkloadIdentityConfigured()).toBe(false);
    });

    it('returns true when GCP_WORKLOAD_IDENTITY_CONFIG is set', () => {
      process.env.GCP_WORKLOAD_IDENTITY_CONFIG = JSON.stringify({ type: 'external_account' });
      expect(isWorkloadIdentityConfigured()).toBe(true);
    });

    it('returns true when discrete provider and service account email are set', () => {
      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = 'projects/123/locations/global/workloadIdentityPools/p/providers/pr';
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com';
      expect(isWorkloadIdentityConfigured()).toBe(true);
    });

    it('returns false if only provider is set without service account email', () => {
      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = 'projects/123/locations/global/workloadIdentityPools/p/providers/pr';
      expect(isWorkloadIdentityConfigured()).toBe(false);
    });
  });

  describe('validateWorkloadIdentityScope', () => {
    it('throws fail-closed error if target project is production (inspirath-d6778)', () => {
      expect(() => {
        validateWorkloadIdentityScope(PRODUCTION_PROJECT_ID);
      }).toThrow(/FAIL-CLOSED SAFETY.*cannot target production project/);
    });

    it('throws fail-closed error if running inside Vercel production deployment', () => {
      process.env.VERCEL_ENV = 'production';
      expect(() => {
        validateWorkloadIdentityScope(STAGING_PROJECT_ID);
      }).toThrow(/FAIL-CLOSED SAFETY.*cannot run in production deployments/);
    });

    it('throws fail-closed error in Vercel preview if branch is unauthorized', () => {
      process.env.VERCEL_ENV = 'preview';
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      expect(() => {
        validateWorkloadIdentityScope(STAGING_PROJECT_ID);
      }).toThrow(/FAIL-CLOSED SAFETY.*restricted to branch "feature\/participant-id-dob-portal"/);
    });

    it('throws fail-closed error in Vercel preview if VERCEL_PROJECT_ID does not match prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y', () => {
      process.env.VERCEL_ENV = 'preview';
      process.env.VERCEL_GIT_COMMIT_REF = ALLOWED_WIF_BRANCH;
      process.env.VERCEL_PROJECT_ID = 'prj_unauthorized_other_project';
      expect(() => {
        validateWorkloadIdentityScope(STAGING_PROJECT_ID);
      }).toThrow(/FAIL-CLOSED SAFETY.*restricted to Vercel Project ID "prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y"/);
    });

    it('permits Vercel preview when branch and project ID match', () => {
      process.env.VERCEL_ENV = 'preview';
      process.env.VERCEL_GIT_COMMIT_REF = ALLOWED_WIF_BRANCH;
      process.env.VERCEL_PROJECT_ID = VERCEL_PROJECT_ID;
      expect(() => {
        validateWorkloadIdentityScope(STAGING_PROJECT_ID);
      }).not.toThrow();
    });

    it('permits custom allowed branch override via GCP_WORKLOAD_IDENTITY_ALLOWED_BRANCH', () => {
      process.env.VERCEL_ENV = 'preview';
      process.env.VERCEL_GIT_COMMIT_REF = 'custom-preview-branch';
      process.env.GCP_WORKLOAD_IDENTITY_ALLOWED_BRANCH = 'custom-preview-branch';
      expect(() => {
        validateWorkloadIdentityScope(STAGING_PROJECT_ID);
      }).not.toThrow();
    });

    it('permits staging project when outside Vercel (e.g. local staging verification script)', () => {
      expect(() => {
        validateWorkloadIdentityScope(STAGING_PROJECT_ID);
      }).not.toThrow();
    });
  });

  describe('buildWorkloadIdentityClient & createWorkloadIdentityCredential', () => {
    it('builds IdentityPoolClient with formatted audience and impersonation url', () => {
      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = 'projects/123456789/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider';
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com';
      process.env.GCP_WORKLOAD_IDENTITY_TOKEN = 'test-token';

      const client = buildWorkloadIdentityClient(STAGING_PROJECT_ID);
      expect(client).toBeDefined();
      expect((client as any).audience).toBe('//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider');
      expect((client as any).serviceAccountImpersonationUrl).toBe('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com:generateAccessToken');
    });

    it('preserves existing audience prefix if already supplied with //', () => {
      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = '//iam.googleapis.com/projects/999/locations/global/workloadIdentityPools/p/providers/pr';
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com';

      const client = buildWorkloadIdentityClient(STAGING_PROJECT_ID);
      expect((client as any).audience).toBe('//iam.googleapis.com/projects/999/locations/global/workloadIdentityPools/p/providers/pr');
    });

    it('supports full GCP credential config JSON in GCP_WORKLOAD_IDENTITY_CONFIG', () => {
      process.env.GCP_WORKLOAD_IDENTITY_CONFIG = JSON.stringify({
        type: 'external_account',
        audience: '//iam.googleapis.com/projects/555/locations/global/workloadIdentityPools/p/providers/pr',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        token_url: 'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url: 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/sa@inspirath-staging.iam.gserviceaccount.com:generateAccessToken'
      });

      const client = buildWorkloadIdentityClient(STAGING_PROJECT_ID);
      expect(client).toBeDefined();
      expect((client as any).audience).toBe('//iam.googleapis.com/projects/555/locations/global/workloadIdentityPools/p/providers/pr');
    });

    it('creates WorkloadIdentityCredential wrapping the client', () => {
      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = 'projects/123/locations/global/workloadIdentityPools/p/providers/pr';
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'sa@inspirath-staging.iam.gserviceaccount.com';

      const credential = createWorkloadIdentityCredential(STAGING_PROJECT_ID);
      expect(credential).toBeInstanceOf(WorkloadIdentityCredential);
    });
  });

  describe('WorkloadIdentityCredential token retrieval', () => {
    it('returns access token and computes expires_in from expiry_date', async () => {
      const mockClient: any = {
        getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-shortlived-token' }),
        cachedAccessToken: {
          access_token: 'mock-shortlived-token',
          expiry_date: Date.now() + 1800 * 1000 // 30 minutes from now
        }
      };

      const credential = new WorkloadIdentityCredential(mockClient);
      const token = await credential.getAccessToken();

      expect(token.access_token).toBe('mock-shortlived-token');
      expect(token.expires_in).toBeGreaterThanOrEqual(1790);
      expect(token.expires_in).toBeLessThanOrEqual(1810);
    });

    it('defaults expires_in to 3600 seconds when cached expiry_date is absent', async () => {
      const mockClient: any = {
        getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token-no-cache' }),
        cachedAccessToken: null
      };

      const credential = new WorkloadIdentityCredential(mockClient);
      const token = await credential.getAccessToken();

      expect(token.access_token).toBe('mock-token-no-cache');
      expect(token.expires_in).toBe(3600);
    });

    it('throws error when client returns an empty token', async () => {
      const mockClient: any = {
        getAccessToken: vi.fn().mockResolvedValue({ token: null })
      };

      const credential = new WorkloadIdentityCredential(mockClient);
      await expect(credential.getAccessToken()).rejects.toThrow(/Failed to acquire access token/);
    });
  });

  describe('getAdminApp with Workload Identity Federation', () => {
    it('initializes Admin App targeting staging using WIF credential when configured', async () => {
      process.env.ALLOW_STAGING_WIF_TEST = 'true';
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
      delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;

      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = 'projects/123456/locations/global/workloadIdentityPools/p/providers/pr';
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com';
      process.env.FIREBASE_ADMIN_PROJECT_ID = STAGING_PROJECT_ID;

      const app = getAdminApp();
      expect(app).not.toBeNull();
      expect(app?.options.projectId).toBe(STAGING_PROJECT_ID);
    });

    it('fails closed when WIF attempts to target production project', async () => {
      process.env.ALLOW_STAGING_WIF_TEST = 'true';
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
      delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;

      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER = 'projects/123456/locations/global/workloadIdentityPools/p/providers/pr';
      process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com';
      process.env.FIREBASE_ADMIN_PROJECT_ID = PRODUCTION_PROJECT_ID;

      expect(() => {
        getAdminApp();
      }).toThrow(/FAIL-CLOSED SAFETY/);
    });
  });
});
