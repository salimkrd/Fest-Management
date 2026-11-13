# Fresh-fest production reset

This runbook is for intentionally clearing the current festival data from the
production Firebase project so the next festival can be configured from a clean
state.

## What the reset preserves

The reset preserves only:

- The one canonical Chief Administrator Firebase Auth account referenced by
  `settings/bootstrapLock.adminUid`.
- The matching `users/{ChiefAdminUid}` Firestore document.
- The committed `settings/bootstrapLock` document.

The existing Chief Admin can continue to sign in. The bootstrap lock remains
committed, so the initial-admin bootstrap flow is not reopened.

## What the reset removes

After a verified local backup and the explicit typed confirmation, it removes:

- All other Firestore documents and nested subcollections, including festival
  settings/theme, categories, teams, participants, competitions, registrations,
  stages, schedules, judges, judge assignments, marks, results, posters metadata,
  points ledger, leaderboard and audit logs.
- All Firebase Authentication accounts except the canonical Chief Admin,
  including team managers, judges/staff identities and participant accounts.
- Every object in the configured production Storage bucket, including
  participant images, logos, posters, and export files.

It does not change application source code, Firebase Security Rules, Firebase
indexes, Vercel environment variables, custom domains, or the Firebase project.

## Run on the administrator workstation

Use the latest `main` code after the reset utility PR is reviewed and merged.
Run these commands from the repository root in PowerShell:

```powershell
npm ci
npm run reset:production
```

The first command is a read-only dry-run inventory. Check the target project,
canonical Chief Admin, collection counts, Auth user count, and Storage object
count carefully.

Only when those values are correct, execute the reset:

```powershell
npm run reset:production -- --execute
```

The script requires a local production service-account JSON file at
`C:\Users\Admin\.credentials\inspirath-d6778-firebase-adminsdk.json`.
If it is stored elsewhere, set `FIREBASE_SERVICE_ACCOUNT_PATH` to that local
path in the current PowerShell session. Never put the credential file in the
repository, OneDrive-shared source folders, or a public location.

Execution asks for the exact phrase `RESET_INSPIRATH_PRODUCTION`. The reset
aborts if the production project or bucket does not match, an emulator
environment variable is present, the Chief Admin/bootstrap lock is ambiguous,
the backup is incomplete, or the confirmation does not match.

## Backup and credential limitations

Before deleting anything, the script writes a local timestamped backup under
`backups/production_fest_reset_*` containing:

- Every Firestore document and nested subcollection in a compressed JSONL
  export, with special Firestore values represented explicitly.
- Firebase Auth user metadata and custom claims.
- Every Storage object plus its original object name and metadata.

Keep this backup in a secure, access-controlled location and verify it has
copied successfully before reusing or deleting the local copy. The Auth export
does **not** contain users' passwords or recoverable password hashes. Deleted
non-admin accounts will need to be recreated and users will need new
credentials. The JSONL export is a preservation artifact, not a one-click
Firestore restore package.

After execution, the script verifies that only the canonical Chief Admin user
document and bootstrap lock remain, that only the canonical Chief Admin Auth
account remains, that there are no nested Firestore documents, and that the
Storage bucket is empty.
