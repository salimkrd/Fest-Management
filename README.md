# Inspirath Fest Management Application — Sahithyolsav 2025

A security-hardened, real-time festival management platform built for **Sahithyolsav 2025** (Markaz Knowledge City). The system powers full end-to-end festival workflows including competition scheduling, dynamic team provisioning, secure WhatsApp manager onboarding, blinded judge scoring, real-time mark tabulation, and automated championship calculations.

---

## Key Features & Architecture

- **Next.js App Router & TypeScript**: Fast, reactive server-side and client-side rendering with Tailwind CSS and Vanilla styling.
- **Dynamic Team Management**: Dynamic team creation with 1:1 automated Team Manager identity provisioning. No hardcoded or predefined team limits.
- **Manual WhatsApp Onboarding**:
  - 128-bit CSPRNG one-time invitation tokens (`INSP-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`).
  - Plaintext tokens are never stored in Firestore; only SHA-256 hashes are persisted in private manager subcollections (`/teams/{teamId}/private/managerInfo`).
  - WhatsApp deep-link generation (`wa.me/{phone}`) with zero secrets in URL query parameters.
  - Multi-phase atomic activation with 24-hour expiration, single-use redemption, rate-limiting lockout (5 failed attempts = 15-minute lockout), and strict rollback on partial failures.
- **Role-Based Access Control**:
  - Chief Administrator (`ADMIN`)
  - Team Managers (`TEAM_MANAGER`) isolated strictly to their assigned team workspace (`/team`)
  - Judges (`JUDGE`) authenticating via secure competition PINs
  - Public audience (`PUBLIC`) with real-time published scoreboards and podium views
- **Deterministic 40-Combination Scoring Engine**:
  - 4 Categories (Sub-Junior, Junior, Senior, General) × 2 Types (Single, Group) × 5 Ranks (1st, 2nd, 3rd, Grade A, Grade B).
  - Atomic point ledger preventing double-counting and race conditions.
- **Firebase Security Rules & Isolation**:
  - Zero-trust Firestore rules blocking unauthorized direct client writes to critical collections (`markEntries`, `ledger`, `private`).
  - Local emulator isolation guaranteeing safety during development and CI testing.

---

## Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Java Runtime Environment (JRE)**: Version 11 or higher (required for Firebase Local Emulator Suite)
- **Firebase CLI**: `npm install -g firebase-tools`

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/salimkrd/Fest-Management.git
cd Fest-Management
npm install
```

### 2. Configure Environment Variables

Copy the template to `.env.local`:

```bash
cp .env.example .env.local
```

For local development with the Firebase Emulator Suite, ensure the emulator flags are enabled in `.env.local`:

```env
# Client-side configuration (Emulator Mode)
NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-sahithyolsav-2025"
NEXT_PUBLIC_FIREBASE_API_KEY="demo-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="demo-sahithyolsav-2025.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="demo-sahithyolsav-2025.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="000000000000"
NEXT_PUBLIC_FIREBASE_APP_ID="1:000000000000:web:demowebapp"

# Emulator Isolation Controls
NEXT_PUBLIC_USE_FIREBASE_EMULATOR="true"
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:9199"

FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:9199"

# Server-side Admin SDK
FIREBASE_ADMIN_PROJECT_ID="demo-sahithyolsav-2025"
```

> **Security Note:** Never commit `.env.local` or any production credentials. All `.env*` files (except `.env.example`) are strictly ignored by `.gitignore`.

### 3. Start Firebase Local Emulators

Start the local Firebase Emulator Suite (Firestore, Auth, Storage, and Emulator UI):

```bash
npm run emulators
```

The Firebase Emulator UI will be available at:
- **Emulator UI Hub**: [http://127.0.0.1:4000](http://127.0.0.1:4000)
- **Firestore**: `127.0.0.1:8080`
- **Auth**: `127.0.0.1:9099`
- **Storage**: `127.0.0.1:9199`

### 4. Run the Development Server

In a separate terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Automated Tests

The application features a comprehensive test suite covering security rules, domain logic, dynamic team provisioning, concurrency protection, and rate-limiting.

Run all tests via Vitest:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Full Fest Emulator Simulation

With the Firebase Emulator Suite and the development server running, execute the end-to-end scale simulation from PowerShell:

```powershell
$env:FEST_SIM_ADMIN_EMAIL = "admin@sahithyolsav.com"
$env:FEST_SIM_ADMIN_PASSWORD = "<local emulator admin password>"
npm run simulate:fest
Remove-Item Env:FEST_SIM_ADMIN_PASSWORD
```

The runner is hard-pinned to the `demo-sahithyolsav-2025` project and local emulator ports. It creates 4 teams, 40 participants, 100 competitions, 400 registrations, 10 judges, submitted marks, published results, and live listeners in two independent Firestore clients. It verifies category eligibility, generated bib/chest and registration codes, scoring, ledger totals, leaderboard totals, and subscribed team standings. Result publication is batched through the trusted admin API and recalculates global standings once per run.

Simulation records are retained in the emulator for inspection and use unique run-prefixed IDs; the runner does not clear or reset existing emulator data. It reports per-endpoint request counts and p95/max latency. It never targets the production Firebase project.

To resume publication and final realtime/ledger checks for an interrupted run, set its exact run ID (for example, `sim-20261023124356-lkq2`) and run:

```powershell
$env:FEST_SIM_RESUME_ID = "sim-20261023124356-lkq2"
$env:FEST_SIM_ADMIN_EMAIL = "admin@sahithyolsav.com"
$env:FEST_SIM_ADMIN_PASSWORD = "<local emulator admin password>"
npm run simulate:resume:fest
Remove-Item Env:FEST_SIM_RESUME_ID, Env:FEST_SIM_ADMIN_PASSWORD
```

---

## Production Deployment & Operational Safeguards

Before deploying to production (e.g., Vercel + Live Firebase):

### 1. Vercel Git-Based Automatic Deployment Behavior
- **Default Vercel Behavior**: Connecting this repository to Vercel enables automatic production deployments on every push to the `main` branch.
- **Release Control**: If you wish to stage or gate production releases, configure **Ignored Build Step** or enable deployment protection/preview branch promotions in the Vercel Project Settings.
- **Runtime Environment**: Uses Node.js `22.x` as declared in `package.json` (`engines`) and `.nvmrc`.

### 2. Trusted HTTPS Canonical URL
- Set `NEXT_PUBLIC_APP_URL` in Vercel Production Environment Variables to your confirmed HTTPS domain (e.g., `https://fest.example.com` or your production Vercel URL).
- Arbitrary forwarded host headers (`host`, `x-forwarded-host`) are strictly rejected in production to eliminate Host Header Injection vulnerabilities.

### 3. Firebase Security Rules Deployment & Rollback
- **Explicit Project Required**: Production deployments must explicitly target `--project production` (`inspirath-d6778`):
  ```bash
  firebase deploy --project production --only firestore:rules
  firebase deploy --project production --only storage
  firebase deploy --project production --only firestore:indexes
  ```
- **Rules Rollback Procedure**: Always preserve a local backup of the previously active rules source file (e.g., in `backups/`). To roll back rules, restore the previous rules file content and redeploy:
  ```bash
  firebase deploy --project production --only firestore:rules
  ```

### 4. Admin SDK & Bootstrap Security
- In Vercel, provide `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` (or `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`).
- **Do NOT configure `ADMIN_BOOTSTRAP_SECRET` on the web application**: The authoritative Chief Administrator account is already provisioned and locked; bootstrap endpoints are retired from runtime web operation.
- Ensure all emulator variables (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_USE_FIREBASE_EMULATOR`) are absent in the production environment.

---

## License

Private repository — All rights reserved © Sahithyolsav 2025 / Inspirath Fest Management.
