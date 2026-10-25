# Keyless Workload Identity Federation for INSPIRATH Staging

## 1. Overview & Security Architecture

Google Cloud Organization Policy enforces `iam.disableServiceAccountKeyCreation` to prevent downloading and storing service account JSON private keys.

This document describes how **Vercel Preview** securely authenticates to Firebase Admin in the **`inspirath-staging`** environment without service account private keys, using **Vercel OIDC** and **Google Cloud Workload Identity Federation (WIF)**.

```
┌─────────────────────────┐
│     Vercel Preview      │
│  (feature/participant-  │
│      id-dob-portal)     │
└───────────┬─────────────┘
            │ 1. OIDC Token (JWT issued by https://oidc.vercel.com)
            ▼
┌─────────────────────────┐
│ Google Cloud Security   │
│   Token Service (STS)   │
│  (Workload Identity)    │
└───────────┬─────────────┘
            │ 2. Validates Issuer, Audience & CEL Branch/Repo Claims
            ▼
┌─────────────────────────┐
│   IAM Credentials API   │
│ (Impersonates Staging   │
│    Service Account)     │
└───────────┬─────────────┘
            │ 3. Short-Lived OAuth2 Access Token (1 hour max lifetime)
            ▼
┌─────────────────────────┐
│   Firebase Admin SDK    │
│  (Firestore & Auth in   │
│    inspirath-staging)   │
└─────────────────────────┘
```

### Security Invariants & Compliance
1. **Zero Private Keys**: No service account keys are created, downloaded, or committed.
2. **Production Isolation**: Production Firebase (`inspirath-d6778`) configuration is completely preserved. Automated fail-closed guards reject Workload Identity if configured against production.
3. **Least Privilege & Strict Scoping**: Federated access is cryptographically restricted to:
   - GitHub Repository: `salimkrd/Fest-Management`
   - Git Branch: `feature/participant-id-dob-portal`
   - Vercel Environment: `preview`
   - Target GCP Project: `inspirath-staging`

---

## 2. Google Cloud Configuration Instructions

Perform these steps in the Google Cloud Console for project **`inspirath-staging`** (or via `gcloud` CLI):

### Step 1: Enable Required GCP APIs
Ensure the following APIs are enabled in `inspirath-staging`:
- **Identity and Access Management (IAM) API**: `iam.googleapis.com`
- **IAM Service Account Credentials API**: `iamcredentials.googleapis.com`
- **Security Token Service API**: `sts.googleapis.com`
- **Cloud Firestore API**: `firestore.googleapis.com`

**Console Navigation**:
> *APIs & Services* > *Library* > Search and enable each API.

**CLI Command**:
```bash
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  firestore.googleapis.com \
  --project=inspirath-staging
```

---

### Step 2: Create Staging Service Account
Create a dedicated service account for Vercel Preview staging operations:
- **Service Account Name**: `vercel-staging-sa`
- **Service Account ID**: `vercel-staging-sa`
- **Email**: `vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com`

**Assign Least-Privilege IAM Roles**:
- `roles/datastore.user` (Cloud Datastore User: provides read/write access to Firestore staging data)
- `roles/firebaseauth.admin` (Firebase Authentication Admin: manages participant authentication)

**Console Navigation**:
> *IAM & Admin* > *Service Accounts* > *Create Service Account*
> Name: `vercel-staging-sa`
> Roles: `Cloud Datastore User`, `Firebase Authentication Admin`

**CLI Command**:
```bash
gcloud iam service-accounts create vercel-staging-sa \
  --description="Service account for Vercel Preview staging deployments" \
  --display-name="Vercel Staging Service Account" \
  --project=inspirath-staging

gcloud projects add-iam-policy-binding inspirath-staging \
  --member="serviceAccount:vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding inspirath-staging \
  --member="serviceAccount:vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"
```

---

### Step 3: Create Workload Identity Pool & Provider
Retrieve your GCP Project Number:
```bash
gcloud projects describe inspirath-staging --format="value(projectNumber)"
# Let PROJECT_NUMBER be your numerical project ID (e.g. 123456789012)
```

#### A. Create the Workload Identity Pool
- **Pool ID**: `vercel-pool`
- **Display Name**: `Vercel Preview Deployments Pool`

**Console Navigation**:
> *IAM & Admin* > *Workload Identity Federation* > *Create Pool*
> Name: `vercel-pool`

**CLI Command**:
```bash
gcloud iam workload-identity-pools create vercel-pool \
  --location="global" \
  --description="Workload Identity Pool for Vercel Preview Deployments" \
  --display-name="Vercel Preview Pool" \
  --project=inspirath-staging
```

#### B. Add OIDC Provider to the Pool
- **Provider ID**: `vercel-provider`
- **Display Name**: `Vercel OIDC Provider`
- **Issuer (URL)**: `https://oidc.vercel.com`
- **Allowed Audiences**: `https://vercel.com/salimkrd` (or your Vercel team/user slug)
- **Attribute Mapping**:
  | Google Attribute | OIDC Token Attribute |
  |---|---|
  | `google.subject` | `assertion.sub` |
  | `attribute.owner` | `assertion.owner` |
  | `attribute.project` | `assertion.project` |
  | `attribute.environment` | `assertion.environment` |
  | `attribute.branch` | `assertion.branch` |
  | `attribute.repo` | `assertion.repo` |

- **Attribute Condition (CEL)**:
  Enforces that tokens are ONLY accepted from the Participant Portal branch in the official repository:
  ```cel
  assertion.repo == "salimkrd/Fest-Management" && assertion.branch == "feature/participant-id-dob-portal" && assertion.environment == "preview"
  ```

**CLI Command**:
```bash
gcloud iam workload-identity-pools providers create-oidc vercel-provider \
  --location="global" \
  --workload-identity-pool="vercel-pool" \
  --issuer-uri="https://oidc.vercel.com" \
  --allowed-audiences="https://vercel.com/salimkrd" \
  --attribute-mapping="google.subject=assertion.sub,attribute.owner=assertion.owner,attribute.project=assertion.project,attribute.environment=assertion.environment,attribute.branch=assertion.branch,attribute.repo=assertion.repo" \
  --attribute-condition="assertion.repo == 'salimkrd/Fest-Management' && assertion.branch == 'feature/participant-id-dob-portal' && assertion.environment == 'preview'" \
  --project=inspirath-staging
```

---

### Step 4: Grant Workload Identity Impersonation Permissions
Bind the Workload Identity Pool principal set to the staging service account with the `Workload Identity User` role and `Service Account Token Creator` role:

**CLI Command**:
```bash
# Allow the federated principal set matching the Participant Portal branch to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/attribute.branch/feature/participant-id-dob-portal" \
  --project=inspirath-staging

# Allow token creation for impersonation
gcloud iam service-accounts add-iam-policy-binding vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="principalSet://iam.googleapis.com/projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/attribute.branch/feature/participant-id-dob-portal" \
  --project=inspirath-staging
```

---

## 3. Vercel Project Environment Configuration

Configure the following environment variables in the **Vercel Dashboard**:
> *Project Settings* > *Environment Variables*

> [!IMPORTANT]
> Scope these variables strictly to **Preview** environment and filter by branch `feature/participant-id-dob-portal`.
> Do **NOT** set them in Production. Production credentials remain untouched.

### Required Environment Variables

| Variable | Value | Scope | Description |
|---|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | `inspirath-staging` | Preview | Target staging Firebase project |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `inspirath-staging` | Preview | Client staging project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider` | Preview | Workload Identity Provider resource path |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `vercel-staging-sa@inspirath-staging.iam.gserviceaccount.com` | Preview | Staging service account to impersonate |
| `GCP_WORKLOAD_IDENTITY_AUDIENCE` | `//iam.googleapis.com/projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider` | Preview | STS audience identifier |
| `GCP_WORKLOAD_IDENTITY_ALLOWED_BRANCH` | `feature/participant-id-dob-portal` | Preview | Fail-closed branch constraint |
| `PARTICIPANT_SESSION_SECRET` | *(Random 32+ char secret string)* | Preview | Participant portal JWT signing secret |
| `QR_SIGNING_SECRET` | *(Random 32+ char secret string)* | Preview | Cryptographic QR badge signing secret |

*Note: Replace `[PROJECT_NUMBER]` with the numerical GCP Project Number of `inspirath-staging`.*

---

## 4. Code Implementation Architecture

### 1. `WorkloadIdentityCredential` (`src/lib/firebase/admin.ts`)
Implements Firebase Admin SDK's `Credential` interface using `google-auth-library`'s `IdentityPoolClient`.
- Resolves Vercel OIDC token from `process.env.VERCEL_OIDC_TOKEN`, `VERCEL_OIDC_TOKEN_FILE`, or `GCP_WORKLOAD_IDENTITY_TOKEN`.
- Automatically handles Security Token Service (STS) token exchange and Service Account impersonation.
- Obtains short-lived Google Cloud OAuth2 access tokens and calculates remaining validity.

### 2. Strict Fail-Closed Safety Guards
- `validateWorkloadIdentityScope(targetProjectId)`:
  - Immediately throws `[FAIL-CLOSED SAFETY]` if `targetProjectId === 'inspirath-d6778'`.
  - Immediately throws `[FAIL-CLOSED SAFETY]` if executed within Vercel production deployment (`VERCEL_ENV === 'production'`).
  - Immediately throws `[FAIL-CLOSED SAFETY]` if running in Vercel preview on an unapproved branch (`VERCEL_GIT_COMMIT_REF !== 'feature/participant-id-dob-portal'`).

### 3. Production Isolation Preservation
The Firebase Admin initialization hierarchy in `getAdminApp()`:
1. Local Firebase Emulator (if running).
2. `GOOGLE_APPLICATION_CREDENTIALS` (production live).
3. `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` (production live).
4. `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` (production live).
5. Workload Identity Federation (keyless staging/preview).

Because steps 1-4 execute before step 5, production configurations and credentials are 100% preserved without any modification.

---

## 5. Verification & Testing

### Running the Staging Verification Script
The dedicated verification script validates:
- Target project isolation
- WIF scope validation and fail-closed safety
- Bib + DOB login with `1042` and `#1042`
- Participant dashboard `/api/participant/me` with data isolation (DOB and phone protected)
- Individual SOLO points vs group TEAM points isolation
- Signed digital ID QR badge generation `/api/participant/qr` and cryptographic verification

```bash
node node_modules/tsx/dist/cli.mjs scripts/verifyStagingParticipantPortal.ts
```

### Running the Full Regression Test Suite
```bash
node node_modules/vitest/vitest.mjs run
```

### Running Next.js Production Build
```bash
node node_modules/next/dist/bin/next build
```
