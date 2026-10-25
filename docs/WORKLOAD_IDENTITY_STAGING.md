# Secure, Keyless Workload Identity Federation for INSPIRATH Staging

## 1. Overview & Security Architecture

Google Cloud Organization Policy enforces `iam.disableServiceAccountKeyCreation` to prevent downloading and storing service account JSON private keys.

This document describes how **Vercel Preview** securely authenticates to Firebase Admin in the **`inspirath-staging`** environment without service account private keys, using **Vercel OIDC (`@vercel/oidc`)** and **Google Cloud Workload Identity Federation (WIF)**.

```
┌──────────────────────────────────────┐
│            Vercel Preview            │
│ (feature/participant-id-dob-portal)  │
│  Project: prj_MmRcs7gArslBmtJxmHG... │
└──────────────────┬───────────────────┘
                   │ 1. OIDC Token via @vercel/oidc (request context / rotating file)
                   │    Claims: sub, project_id, owner_id, environment
                   ▼
┌──────────────────────────────────────┐
│    Google Security Token Service     │
│             (GCP STS)                │
└──────────────────┬───────────────────┘
                   │ 2. Validates Issuer, Audience & CEL Condition:
                   │    project_id == "prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y" &&
                   │    environment == "preview"
                   ▼
┌──────────────────────────────────────┐
│         IAM Credentials API          │
│   (Impersonates Staging SA via       │
│    roles/iam.workloadIdentityUser)   │
└──────────────────┬───────────────────┘
                   │ 3. Short-Lived OAuth2 Access Token (1 hour max lifetime)
                   ▼
┌──────────────────────────────────────┐
│          Firebase Admin SDK          │
│   (Cloud Firestore data access in    │
│          inspirath-staging)          │
└──────────────────────────────────────┘
```

---

## 2. Key Technical Findings & Verified Specifications

### 1. Vercel OIDC Token Retrieval (`@vercel/oidc`)
- In Vercel serverless functions, the OIDC token is **not reliably exposed as `process.env.VERCEL_OIDC_TOKEN`** at runtime.
- Instead, Vercel provides short-lived tokens per request via the `x-vercel-oidc-token` HTTP header and writes rotating tokens to a file path designated by `VERCEL_OIDC_TOKEN_FILE`.
- The application uses the official **`@vercel/oidc`** package (`getVercelOidcToken({ expirationBufferMs: 300000 })`), which reads the token from the Vercel request context (via `AsyncLocalStorage`), reads from the token file, and handles automatic token refresh prior to expiration.
- For local verification and test runners, the code provides clean fallback to `GCP_WORKLOAD_IDENTITY_TOKEN` or `VERCEL_OIDC_TOKEN`.

### 2. Verified Vercel OIDC Claims
Standard Vercel OIDC tokens contain the following verified claims:
- **`sub`**: Subject formatted as `owner:[owner]:project:[project]:environment:[env]`
- **`project_id`**: Unique Vercel project ID (**`prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y`**)
- **`owner_id`**: Unique Vercel team/user account ID (`team_...` or user ID)
- **`environment`**: Deployment environment (`preview`, `production`, `development`)
- **`owner`**: Vercel team or user slug
- **`project`**: Vercel project slug
- **Important**: `assertion.repo` and `assertion.branch` are **not** standard documented Vercel OIDC claims. Google Cloud attribute mappings and CEL conditions must **only** reference verified claims (`assertion.sub`, `assertion.project_id`, `assertion.owner_id`, `assertion.environment`).

### 3. Git Branch Isolation & Defense-in-Depth
Because Vercel OIDC does not issue a Git branch claim in the JWT, Google Cloud cannot cryptographically verify the Git branch at the STS token boundary.
Branch isolation is enforced through two layers:
1. **Vercel Branch-Scoped Configuration**: In the Vercel Dashboard, all Workload Identity environment variables (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, etc.) are scoped exclusively to the **Preview** environment and filtered specifically to branch **`feature/participant-id-dob-portal`**.
2. **Application Fail-Closed Boundary**: `validateWorkloadIdentityScope()` enforces that when `VERCEL_ENV === 'preview'`, `process.env.VERCEL_GIT_COMMIT_REF` must match `feature/participant-id-dob-portal`, immediately aborting with a `[FAIL-CLOSED SAFETY]` exception on unauthorized branches.

### 4. Vercel OIDC Issuer Modes (Team vs Global)
Vercel supports two issuer configurations under **Project Settings** > **Security** > **Secure backend access with OIDC federation**:

| Configuration | Team Mode (Default & Recommended) | Global Mode |
|---|---|---|
| **Issuer URL (`iss`)** | `https://oidc.vercel.com/[TEAM_SLUG]` (e.g., `https://oidc.vercel.com/salimkrd`) | `https://oidc.vercel.com` |
| **Audience (`aud`)** | `https://vercel.com/[TEAM_SLUG]` or Provider Resource Name | `https://vercel.com/[TEAM_SLUG]` or Provider Resource Name |
| **Well-Known Discovery** | `https://oidc.vercel.com/[TEAM_SLUG]/.well-known/openid-configuration` | `https://oidc.vercel.com/.well-known/openid-configuration` |
| **Security Benefit** | Rejects tokens from any other Vercel team at the issuer level | Requires evaluating `owner_id` and `project_id` in provider claims |

*To determine which mode your Vercel project uses, navigate to **Settings** > **Security** on your Vercel project dashboard. If a team slug is shown in the OIDC configuration, use Team Mode.*

### 5. Least-Privilege IAM Roles
For the Participant Portal staging preview:
- **Cloud Datastore User (`roles/datastore.user`)**: **REQUIRED**. Grants read/write access to Cloud Firestore documents (`participants`, `competitions`, `registrations`, `results`, and `participantLoginAttempts` rate limits).
- **Firebase Authentication Admin (`roles/firebaseauth.admin`)**: **NOT NEEDED / OMITTED**. The Participant Portal authenticates using short Bib + DOB and issues server-signed HMAC session cookies (`inspirath_participant_session`). It does not create or manage Firebase Auth accounts.
- **Service Account Token Creator (`roles/iam.serviceAccountTokenCreator`)**: **NOT NEEDED / OMITTED**. The federated identity receives `roles/iam.workloadIdentityUser` on the service account, which already includes `iam.serviceAccounts.getAccessToken`. Granting Token Creator on top of Workload Identity User is redundant.

---

## 3. Google Cloud Console Step-by-Step Instructions

Perform these steps in Google Cloud Platform for project **`inspirath-staging`**:

### Step 1: Enable Required GCP APIs
Navigate to **APIs & Services** > **Library** and enable:
- `iam.googleapis.com` (Identity and Access Management API)
- `iamcredentials.googleapis.com` (IAM Service Account Credentials API)
- `sts.googleapis.com` (Security Token Service API)
- `firestore.googleapis.com` (Cloud Firestore API)

*gcloud CLI:*
```bash
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  firestore.googleapis.com \
  --project=inspirath-staging
```

---

### Step 2: Create Staging Service Account (Least-Privilege)
1. Navigate to **IAM & Admin** > **Service Accounts** > **Create Service Account**.
2. Settings:
   - **Service account name**: `vercel-staging-sa`
   - **Service account ID**: `vercel-staging-sa`
   - **Email**: `vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com`
3. Grant **only** the following role:
   - **Cloud Datastore User** (`roles/datastore.user`)
4. Click **Done** (do **NOT** create or download keys).

*gcloud CLI:*
```bash
gcloud iam service-accounts create vercel-staging-sa \
  --description="Service account for Vercel Preview staging operations" \
  --display-name="Vercel Staging Service Account" \
  --project=inspirath-staging

gcloud projects add-iam-policy-binding inspirath-staging \
  --member="serviceAccount:vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

---

### Step 3: Create Workload Identity Pool & Provider
Retrieve the GCP Project Number:
```bash
gcloud projects describe inspirath-staging --format="value(projectNumber)"
# Let PROJECT_NUMBER be the numerical ID (e.g., 123456789012)
```

#### A. Create the Workload Identity Pool
1. Navigate to **IAM & Admin** > **Workload Identity Federation** > **Create Pool**.
   - **Pool Name**: `vercel-pool`
   - **Display Name**: `Vercel Preview Deployments Pool`
2. Click **Save**.

*gcloud CLI:*
```bash
gcloud iam workload-identity-pools create vercel-pool \
  --location="global" \
  --description="Workload Identity Pool for Vercel Preview Deployments" \
  --display-name="Vercel Preview Pool" \
  --project=inspirath-staging
```

#### B. Add OIDC Provider to the Pool
1. In the pool details, click **Add Provider**.
2. **Provider Details**:
   - **Provider Type**: `OpenID Connect (OIDC)`
   - **Provider Name**: `vercel-provider`
   - **Display Name**: `Vercel OIDC Provider`
   - **Issuer (URL)**:
     - For **Team Mode**: `https://oidc.vercel.com/[TEAM_SLUG]` (e.g. `https://oidc.vercel.com/salimkrd`)
     - For **Global Mode**: `https://oidc.vercel.com`
   - **Allowed Audiences**:
     - `https://vercel.com/[TEAM_SLUG]` (e.g. `https://vercel.com/salimkrd`)
     - Or add the provider resource URI: `//iam.googleapis.com/projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider`
3. **Configure Attribute Mapping**:
   | Google Cloud Attribute | OIDC Token Expression |
   |---|---|
   | `google.subject` | `assertion.sub` |
   | `attribute.project_id` | `assertion.project_id` |
   | `attribute.owner_id` | `assertion.owner_id` |
   | `attribute.environment` | `assertion.environment` |
   | `attribute.owner` | `assertion.owner` |
   | `attribute.project` | `assertion.project` |

4. **Attribute Condition (CEL)**:
   Restrict access cryptographically to the exact Vercel project ID and preview environment:
   ```cel
   assertion.project_id == "prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y" && assertion.environment == "preview"
   ```
5. Click **Save**.

*gcloud CLI (Team Mode example):*
```bash
gcloud iam workload-identity-pools providers create-oidc vercel-provider \
  --location="global" \
  --workload-identity-pool="vercel-pool" \
  --issuer-uri="https://oidc.vercel.com/salimkrd" \
  --allowed-audiences="https://vercel.com/salimkrd" \
  --attribute-mapping="google.subject=assertion.sub,attribute.project_id=assertion.project_id,attribute.owner_id=assertion.owner_id,attribute.environment=assertion.environment,attribute.owner=assertion.owner,attribute.project=assertion.project" \
  --attribute-condition="assertion.project_id == 'prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y' && assertion.environment == 'preview'" \
  --project=inspirath-staging
```

---

### Step 4: Grant Workload Identity Impersonation on Service Account
Grant the federated principal set matching Vercel Project ID `prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y` permission to impersonate `vercel-staging-sa`:

1. Navigate to **IAM & Admin** > **Service Accounts**.
2. Click on `vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com`.
3. Go to the **Permissions** tab and click **Grant Access**.
4. **New Principal**:
   ```
   principalSet://iam.googleapis.com/projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/attribute.project_id/prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y
   ```
5. **Role**: **Workload Identity User** (`roles/iam.workloadIdentityUser`).
6. Click **Save**.

*gcloud CLI:*
```bash
gcloud iam service-accounts add-iam-policy-binding vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/attribute.project_id/prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y" \
  --project=inspirath-staging
```

---

## 4. Vercel Preview Environment Variables Configuration

In the Vercel Dashboard for project **`salimkrd/Fest-Management`**:
1. Navigate to **Settings** > **Environment Variables**.
2. Add the following variables:
   - **Environment**: Select **Preview** ONLY (uncheck Production and Development).
   - **Branch Filter**: Set specifically to **`feature/participant-id-dob-portal`**.

| Variable Name | Example Value | Description |
|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | `inspirath-staging` | Target staging Firebase project |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `inspirath-staging` | Client staging project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider` | Full provider resource path |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com` | Staging service account email |
| `GCP_WORKLOAD_IDENTITY_AUDIENCE` | `https://vercel.com/[TEAM_SLUG]` (or `//iam.googleapis.com/...`) | OIDC audience configured in GCP |
| `GCP_WORKLOAD_IDENTITY_ALLOWED_BRANCH` | `feature/participant-id-dob-portal` | Application-level branch restriction |
| `GCP_WORKLOAD_IDENTITY_VERCEL_PROJECT_ID`| `prj_MmRcs7gArslBmtJxmHG4Nxn7iI4y` | Application-level project ID verification |
| `PARTICIPANT_SESSION_SECRET` | *(Random 32+ character string)* | Session token signing secret |
| `QR_SIGNING_SECRET` | *(Random 32+ character string)* | Digital ID QR cryptographic signing secret |

---

## 5. Local Verification vs Live Vercel-to-GCP Verification

| Scope | What is Proven Locally | What Requires Live Vercel-to-GCP Verification |
|---|---|---|
| **OIDC Subject Token Retrieval** | Fallback to `GCP_WORKLOAD_IDENTITY_TOKEN`, `VERCEL_OIDC_TOKEN`, and `VERCEL_OIDC_TOKEN_FILE`; `@vercel/oidc` import and options format. | Live retrieval of `x-vercel-oidc-token` from the active Vercel Function request context and live token refresh. |
| **GCP STS Token Exchange** | `IdentityPoolClient` construction, STS audience normalization, impersonation URL format, and custom `WorkloadIdentityCredential` adapter. | Live Google STS token exchange reaching `https://sts.googleapis.com/v1/token` with the Vercel-signed JWT. |
| **IAM Impersonation & Scope** | Strict fail-closed safety guards rejecting production `inspirath-d6778`, non-preview environments, unauthorized branches, and mismatched Vercel project IDs. | Live `iamcredentials.googleapis.com` token issuance for `vercel-staging-sa` based on the GCP Workload Identity Pool binding. |
| **Participant Portal Functionality** | End-to-end Bib (`1042` and `#1042`) + DOB authentication, rate limiting, participant dashboard isolation, individual points vs team points, and digital ID QR cryptographic signing. | Latency, cold-start performance, and network routing between Vercel Serverless Functions and live Cloud Firestore in `inspirath-staging`. |

### Execution Commands

```bash
# 1. Run Workload Identity unit & fail-closed safety tests
node node_modules/vitest/vitest.mjs run src/__tests__/workloadIdentity.test.ts

# 2. Run full regression test suite (492 tests)
node node_modules/vitest/vitest.mjs run

# 3. Run Participant Portal staging verification script
node node_modules/tsx/dist/cli.mjs scripts/verifyStagingParticipantPortal.ts

# 4. Run Next.js production build
node node_modules/next/dist/bin/next build
```
