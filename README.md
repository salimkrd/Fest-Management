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

---

## Production Deployment Checklist

Before deploying to production (e.g. Vercel + Live Firebase):

1. **Canonical Application URL**:
   Set `NEXT_PUBLIC_APP_URL` in production hosting to your verified HTTPS domain (e.g. `https://fest.example.com`). Arbitrary forwarded host headers are strictly rejected to prevent Host Header Injection attacks.
2. **Firebase Production Project**:
   - Create and configure project in Firebase Console.
   - Deploy Firestore Security Rules: `firebase deploy --project production --only firestore:rules`
   - Deploy Storage Security Rules: `firebase deploy --project production --only storage`
   - Deploy Firestore Indexes: `firebase deploy --project production --only firestore:indexes`
3. **Admin SDK Credentials**:
   Provide `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` (or `GOOGLE_APPLICATION_CREDENTIALS` path) in production environment secrets.
4. **Build Verification**:
   Verify production build locally:
   ```bash
   npm run build
   ```

---

## License

Private repository — All rights reserved © Sahithyolsav 2025 / Inspirath Fest Management.
