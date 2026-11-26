# Platform Foundation — Phase 0 Architecture Audit

**Repository:** salimkrd/Fest-Management
**Audit baseline:** main at 91f404d0b9f584d1aff75cdf8546cdfe953bd6d5 (after PR #143)
**Status:** Source inspection completed; local runtime and emulator verification remain outstanding.
**Scope:** Reusable Festival Management Platform using separate client installations and both branding plus festival-configuration customization.

## 1. Confirmed product decisions

1. Client model: separate installation. Each customer receives its own Vercel project/deployment, Firebase project (Auth, Firestore, Storage), environment variables, and custom domain.
2. Customization: both branding and operational/festival configuration.
3. No multi-tenant SaaS in v1. Do not introduce a tenant resolver, global cross-client database, or blanket festivalId migration. Separate Firebase projects are the isolation boundary.
4. One shared, versioned codebase. Avoid permanent per-client code forks; differences should live in validated configuration and supported feature options.
5. INSPIRATH remains a protected production installation. Refactoring must be developed on branches, validated on emulator/staging, and released only through review and deployment checks.

## 2. Current architecture — observed facts

### Application
- Next.js App Router, React 19, TypeScript, Tailwind CSS, Firebase Client SDK and Firebase Admin SDK, deployed through Vercel.
- Vitest and Firebase Emulator Suite support already exist. package.json includes test, build, lint, emulator, and full-festival simulation scripts.
- package.json declares Node.js 24.x.

### Data model and collections
The app uses root-level collections including users, categories, teams, participants, competitions, registrations, stages, schedules, results, judgeAssignments, markEntries, greenRoomAssignments, pointsLedger, leaderboard, auditLogs, settings, systemCounters, and poster/gallery-related collections. Collection access is distributed across FestContext and server services. Firestore rules are written against these paths.

For separate installations, this root-level layout is appropriate: every client has an independent Firestore database. Collection paths do not need tenant prefixes or festivalId fields for v1.

### Authentication and authorization
- Firebase Auth users are mirrored in users/{uid}. Roles include ADMIN, TEAM_MANAGER, JUDGE, GREEN_ROOM_STAFF, and PUBLIC.
- Team Manager claims include teamId; Judge claims include assignment scope.
- AuthService.verifySession verifies the Firebase ID token and checks the authoritative Firestore user record.
- Firestore and Storage rules independently enforce role, active account, and team conditions.
- The current role model has no tenant context. That is acceptable while every client has its own Firebase project.

### Branding and festival settings
- The current public branding document is settings/publicTheme.
- PublicThemeSettings already supports festival and institution names, dates, logo, festival-name font, colors, typography, background/card styles, tagline, and hero text.
- FestivalSettingsModal, FestivalBrand, ThemeService, and FestContext provide part of a branding workflow.
- Firestore rules make publicTheme publicly readable; other settings documents are Admin-only.
- This is a singleton branding document, not a full installation/profile/configuration lifecycle.

### Competition and scoring configuration
- Competition records already include criteria, stage, category, type, performance mode, schedule, group size, and per-team entry limits.
- src/domain/scoring.ts still hardcodes SAHITHYOLSAV_POINTS_MATRIX and Sahithyolsav-specific grade boundaries.
- Competition setup is partly configurable, but there is no complete versioned scoring profile for different client rulebooks.

### Environment and deployment coupling
- Client Firebase configuration is supplied through NEXT_PUBLIC_FIREBASE_* environment variables.
- Firebase Admin initialization includes INSPIRATH/staging project constants, Vercel project identity, staging-only Workload Identity Federation restrictions, and production safety checks.
- .firebaserc identifies INSPIRATH production and demo emulator projects.
- README.md still documents Sahithyolsav/INSPIRATH project assumptions and commands.
- scripts/resetProductionForNewFest.ts is pinned to the INSPIRATH production project and Storage bucket. It is destructive after strict confirmation and must not be used as a generic client provisioning tool.
- Existing WIF restrictions are security controls. Do not weaken them to enable new client environments; define explicit per-installation credential trust.

### Backup and portability
- services/backupMigrationService.ts reads a limited set of collections (categories, teams, competitions, stages, schedules, participants, registrations). It is not a complete installation backup.
- The production reset utility contains broader Firestore/Auth/Storage inventory and backup logic, but is coupled to INSPIRATH and destructive reset operations.
- A non-destructive full backup/restore workflow is required before commercial client onboarding.

## 3. Architecture gaps and risk register

| Priority | Gap | Risk | Required direction |
|---|---|---|---|
| P0 | Firebase Admin setup tied to current INSPIRATH/staging identities | New client projects cannot safely reuse current credential assumptions | Explicit per-installation environment validation and credential policy, preserving fail-closed safeguards |
| P0 | Hardcoded Sahithyolsav scoring matrix and grade bands | Different clients may use different grade and championship rules | Validated, versioned scoring profiles; retain current matrix as a legacy preset |
| P0 | INSPIRATH-specific destructive reset script | Unsafe to reuse for other customers | Keep isolated from customer setup; create a separate safe provisioning flow |
| P1 | No complete installation/profile/config lifecycle | First-run setup and later edits are error-prone | Define installation state, canonical festival profile, public theme projection, and validated configuration documents |
| P1 | README, project aliases, scripts, comments retain old branding/project values | Setup and deployment mistakes | Neutral platform docs and per-installation environment examples |
| P1 | Existing backup migration is partial | Incomplete client recovery and handover | Full Firestore/subcollection and Storage backup/restore, plus explicitly protected Auth handling |
| P1 | No first-run setup wizard / installation manifest | New client configuration is manual and inconsistent | Admin-only, resumable setup wizard and server-validated installation manifest |
| P2 | No explicit feature/module configuration schema | 'Both customization' lacks predictable supported switches | Typed feature allowlist and module configuration; a hidden link is not authorization |
| P2 | Multi-project release rollout not formalized | A shared repository can unintentionally deploy to all linked Vercel projects | Define versioned releases and controlled per-client promotion before client #2 |

## 4. Recommended v1 target architecture

### Installation boundary
Each client owns one Vercel project, one Firebase project (Auth/Firestore/Storage), one production domain, its own secrets/credentials, initial administrator, backup lifecycle, and operational ownership. All installations use the same versioned application source. No installation may read another client's Firebase project. No central cross-client data plane is required for v1.

### Proposed configuration documents (not implemented)
- settings/installation — installation ID, setup state, schema version, platform release version, and configured timestamps. Admin-only.
- settings/festivalProfile — canonical identity, institution, dates, locale/timezone, contact, and venue metadata. Admin-only.
- settings/publicTheme — safe public projection of brand/theme information. Preserve this existing document path for compatibility.
- settings/festivalConfiguration — category/eligibility defaults, allowed competition formats, group rules, enabled modules, and operational defaults.
- settings/scoringProfile — named/versioned grade boundaries, award/position rules, points matrix, and calculation policy.

Do not store the same editable value in several places without a canonical source and trusted projection/update flow. Never expose secrets or personal data in public settings. Validate configuration server-side before saving or using it in calculations.

### Proposed setup lifecycle
UNINITIALIZED → INSTALLATION_VERIFIED → PROFILE_CONFIGURED → FESTIVAL_CONFIGURED → ADMIN_READY → ACTIVE

Setup must be resumable and idempotent. It must fail closed for normal festival operations until required setup and a valid Chief Admin are confirmed. An active installation must never accidentally re-enter first-run setup. Setup must never wipe existing data.

### Customization surfaces
1. Branding: festival/institution identity, logo, palette, supported fonts, public tagline/hero text, domain, and metadata.
2. Festival configuration: categories and eligibility, teams/houses, competition types and group size, judging criteria, grade/points profile, schedule defaults, podium/championship behavior, and public modules.
3. Feature availability: use an explicit typed allowlist; hiding a UI link is not an authorization control.
4. Operations: initial admin provisioning, backup/restore, installation health/version, and release compatibility checks.

### Migration and compatibility
- Keep INSPIRATH root collections and document IDs intact.
- Preserve existing Sahithyolsav scoring as a named legacy preset. Do not silently recalculate historical results or ledger entries.
- Add the versioned configuration layer first; migrate calculation consumers incrementally with equivalence tests against today's matrix.
- Do not bulk rewrite existing documents or add tenant paths in the initial foundation.
- Preserve current RBAC and Firebase rules semantics while introducing setup permissions.

### Release model
- Use one shared source repository; do not create permanent client forks for branding/config-only differences.
- Create a separate Vercel project and Firebase project per customer.
- Validate each release on emulator/staging, then promote it to client installations in a controlled sequence.
- Verify Vercel project/branch behavior before enabling automatic multi-client deployments.
- Maintain compatibility between application release and configuration schema versions.

## 5. Proposed implementation phases

### Phase 0 — Audit and architecture contract
- Complete local inspection of all Firestore collection access, Firebase Admin initialization, route authorization, Storage paths, env variables, scripts, and deployment assumptions.
- Classify INSPIRATH-only, demo-only, and reusable code.
- Freeze isolation and configuration decisions in ADRs.
- No production code, Firebase data, rules, indexes, or production environment variables change in this phase.

### Phase 1 — Platform-safe configuration foundation
- Add typed schemas and validators for installation/profile/config/scoring settings.
- Add platform version and configuration schema readers.
- Preserve settings/publicTheme compatibility.
- Add tests proving legacy INSPIRATH branding and scoring outputs remain unchanged.
- Do not remove a safety guard without a replacement test proving equal or stronger protection.

### Phase 2 — New-installation setup wizard
- Add a resumable, Admin-only setup flow.
- Configure identity, branding, timezone/dates, categories, teams, competition defaults, and scoring profile.
- Bootstrap the first Chief Admin through a one-time guarded process.
- Ensure active installations cannot accidentally re-enter initial setup.

### Phase 3 — Per-client provisioning
- Document and automate Firebase/Vercel setup and environment validation.
- Add storage/rules/index deployment checklist and installation health checks.
- Establish controlled release promotion.
- Create a clean second installation without touching INSPIRATH.

### Phase 4 — Portability and operations
- Deliver non-destructive Firestore/Auth/Storage backup and restore with dry-run, checksums, and restore verification.
- Add release/schema compatibility reporting and client handover documentation.

### Phase 5 — Client acceptance and commercial readiness
- Run a full simulated festival in a fresh installation.
- Verify role isolation, judging, Green Room, scoring, publication, exports, public pages, backup/restore, and domain setup.
- Publish package boundaries, supported options, support, and upgrade policy.

## 6. Required local verification from Antigravity

Antigravity must inspect the checked-out repository at this audit baseline and return evidence. Do not implement features yet.

1. Search all source files for Firestore collection/document paths and produce a complete collection map with readers, writers, security rules, and API routes.
2. Trace every Firebase Client/Admin initialization path. List required environment variables, hardcoded project IDs, credential fallbacks, and WIF restrictions.
3. Trace every route handler/server service to show how Admin, Team Manager, Green Room Staff, Judge, and participant sessions are authenticated and authorized.
4. Inventory Storage paths and rules for read/write/delete.
5. Identify all fest-specific constants: scoring/grade boundaries, category assumptions, rank/tie rules, championship rules, festival identity, demo data, and scripts.
6. Review backup/export/import/reset scripts and identify exactly what they include/exclude. Do not run reset, migration, seed, or production commands.
7. Inspect existing tests and propose minimum emulator/integration tests for a clean second installation.
8. Return findings with file paths and line numbers, proposed changes, compatibility risks, and a phase-by-phase test plan.

**Strict instructions:** Do not edit application code; do not change Firebase rules/indexes; do not deploy; do not read or print .env.local or secrets; do not connect to production Firebase; do not run destructive scripts; do not add festivalId tenant fields. Audit only.

## 7. Phase 0 acceptance criteria

- Complete Firestore collection and Storage path inventory.
- Every project/identity hardcode classified as safety control, INSPIRATH-only operational value, demo/test value, or removable legacy.
- Scoring behavior and historical data compatibility risks documented.
- Complete per-client environment requirement list without secret values.
- Setup, configuration, release, backup, and rollback boundaries documented.
- No runtime behavior or production data changed.