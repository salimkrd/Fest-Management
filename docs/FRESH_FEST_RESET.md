# INSPIRATH fresh-fest production reset

This procedure clears the old festival from production Firebase while preserving
the existing Chief Admin login. The same existing `settings/bootstrapLock`
document controls API maintenance, Firestore writes and Storage writes. No
temporary Firestore document or separate Vercel environment flag is required.

## Preserved records

- The canonical Chief Admin Firebase Auth account referenced by
  `settings/bootstrapLock.adminUid`.
- The matching `users/{ChiefAdminUid}` Firestore document.
- The committed `settings/bootstrapLock` document, including its existing
  admin/bootstrap security fields. The reset utility sets
  `maintenanceMode=true` during the reset and returns it to `false` only
  after successful post-reset verification.

## Removed

- All other Firestore documents and every nested/orphaned subcollection.
- All Firebase Auth accounts except the canonical Chief Admin.
- Every object in the production Storage bucket, including participant photos,
  logos, posters, exports and other uploaded files.

After success, exactly two Firestore documents remain:
`users/{ChiefAdminUid}` and `settings/bootstrapLock`.

The reset does not delete the Firebase project, Firestore Rules, Storage Rules,
indexes, Vercel project, domains or environment variables.

## Mandatory deployment preparation

1. Merge the reset-safeguard PR and deploy the latest application code to the
   production Vercel deployment. It must include root-level `proxy.ts`, which
   reads the existing bootstrap lock using the Firebase Admin SDK and blocks
   every `/api/*` request with HTTP 503 while `maintenanceMode=true`.
2. Deploy both updated Firebase Rules to production. The Firestore rules deny
   every client write and Storage rules deny every client upload/update/delete
   while the same bootstrap-lock field is true:

   ```powershell
   firebase.cmd deploy --project inspirath-d6778 --only firestore:rules,storage
   ```

   Deploying these rules while `maintenanceMode` is absent/false does not
   interrupt normal service. Do not run the reset until both rule deployments
   report success.
3. Confirm the production app origin/domain in Vercel. The reset script checks
   that the live production API returns HTTP 503 with
   `X-Fest-Maintenance: enabled` after it activates the lock.
4. Run the reset from the administrator workstation, not from CI. Use a Firebase
   Admin service-account JSON for exactly `inspirath-d6778`, and ensure the
   terminal is not using Firebase Emulator variables.

## Windows PowerShell

From the repository root, after the production app and both Firebase Rules are
deployed:

```powershell
npm ci

$env:FEST_RESET_APP_URL = "https://YOUR-VERIFIED-PRODUCTION-DOMAIN"
npm run reset:production
```

Review the dry-run inventory first. It is read-only and reports Firestore
collection counts, total documents (including nested/orphaned documents), Auth
account count and Storage object count/bytes.

Only after confirming the project, bucket and inventory:

```powershell
npm run reset:production -- --execute
```

The script requires an interactive terminal confirmation. It then atomically
sets `settings/bootstrapLock.maintenanceMode=true`. This one value activates:

- The Next.js Proxy maintenance gate for every application API request.
- The Firestore Rules write gate for every client SDK create/update/delete.
- The Storage Rules write gate for every client upload/update/delete.

The script verifies the production proxy is live before it starts the backup.
It then re-inventories exact Firestore document update versions, Auth user
fingerprints and Storage object generations. It writes a local backup and verifies:

- Firestore gzip fully decompresses; every JSONL record is valid and unique,
  required preserved documents are present, and document/per-collection counts
  match the locked inventory.
- Auth JSON parses, contains unique UIDs, includes the canonical Chief Admin,
  and its count matches the inventory.
- Every Storage manifest entry points to a downloaded object whose byte count
  and SHA-256 checksum match; total object count and bytes match inventory.
- Backup manifest project, bucket, counts and bytes reconcile with all artifacts.
- A second inventory taken after the backup exactly matches the locked baseline.

Only then does it delete other Firestore documents/subcollections, Storage
objects and non-admin Auth accounts. It verifies the Chief Admin profile, the
bootstrap lock, the single Auth account and empty Storage bucket while
`maintenanceMode=true`. It then makes one final update setting
`maintenanceMode=false`, which releases API, Firestore and Storage writes
together, and verifies that only the two preserved Firestore documents remain.

## Recovery and interruption

- If the proxy preflight or backup verification fails before deletion, the
  script sets `maintenanceMode=false` again; no festival data was deleted.
- If an error occurs after deletion begins, the script intentionally leaves (or
  restores) `maintenanceMode=true`. Do **not** change this field manually.
  All app API, Firestore and Storage writes remain blocked. Inspect the backup
  and live inventories and complete recovery under maintenance mode.
- Keep `backups/production_fest_reset_*` in a secure, access-controlled
  location. Firebase Auth export includes account metadata and custom claims,
  not passwords or recoverable password hashes.
- After successful completion, no extra maintenance document or Vercel
  environment change is required. Normal writes resume from the same atomic
  bootstrap-lock update only after all final checks pass.

**Never run this utility with a demo/emulator project ID, a staging credential,
a different Storage bucket, or from a non-interactive shell.**
