# INSPIRATH fresh-fest production reset

This procedure clears the old festival from production Firebase while preserving
the existing Chief Admin login. The reset is fail-closed: it will not delete
anything unless the production API maintenance proxy is live, client write locks
are active, and every backup artifact passes integrity checks.

## Preserved records

- The canonical Chief Admin Firebase Auth account referenced by
  `settings/bootstrapLock.adminUid`.
- The matching `users/{ChiefAdminUid}` Firestore document.
- The committed `settings/bootstrapLock` document.

A temporary `settings/resetMaintenance` document is created to stop direct
Firestore and Storage client writes. It is removed only after all post-reset
checks pass. The Vercel maintenance environment flag remains active until the
operator removes it and redeploys.

## Removed

- All other Firestore documents and every nested/orphaned subcollection.
- All Firebase Auth accounts except the canonical Chief Admin.
- Every object in the production Storage bucket, including participant photos,
  logos, posters, exports and other uploaded files.

The reset does not delete the Firebase project, Firestore Rules, Storage Rules,
indexes, Vercel project, domains or environment variables.

## Mandatory maintenance preparation

1. In Vercel Project Settings → Environment Variables, add
   `FEST_RESET_MAINTENANCE` with value `1` for **Production** only.
2. Redeploy the production deployment using the latest merged code that includes
   root-level `proxy.ts`. Wait until that deployment is **Ready**.
3. Confirm the production app origin/domain in Vercel. While the flag is enabled,
   all `/api/*` requests return HTTP 503 with
   `X-Fest-Maintenance: enabled`. Direct Firestore and Storage SDK writes are
   also denied once the script creates `settings/resetMaintenance`.
4. Run the reset from the administrator workstation, not from CI. Use a Firebase
   Admin service-account JSON for exactly `inspirath-d6778`, and ensure the
   terminal is not using Firebase Emulator variables.

## Windows PowerShell

From the repository root, after the PR is merged and the maintenance deployment
is Ready:

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

The script requires interactive terminal confirmation. Before it writes the
temporary Firestore lock, it verifies the production API actually returns
HTTP 503 and the `X-Fest-Maintenance: enabled` header.

After the Firestore lock is committed, the script re-inventories exact Firestore
document update versions, Auth user fingerprints, and Storage object generations.
It then writes a local backup and verifies:

- Firestore gzip fully decompresses; every JSONL record is valid and unique and
  the number of records matches the inventory.
- Auth JSON parses, contains unique UIDs, includes the canonical Chief Admin,
  and its count matches the inventory.
- Every Storage manifest entry points to a downloaded object whose byte count
  and SHA-256 checksum match; total object count and bytes match inventory.
- Backup manifest project, bucket, counts and bytes reconcile with all artifacts.
- A second inventory taken after the backup exactly matches the locked baseline.

Only then does it delete the other Firestore documents/subcollections, Storage
objects and non-admin Auth accounts. It verifies the Chief Admin, bootstrap
lock, temporary maintenance lock, single Auth account and empty Storage bucket.
The temporary Firestore lock is removed only after that verification, followed
by a final check that the two preserved Firestore documents remain.

## Recovery and interruption

- If preflight or backup verification fails before deletion, the script releases
  the temporary Firestore lock automatically. Vercel maintenance mode remains on.
- If an error occurs after deletion begins, the script intentionally leaves (or
  restores) the Firestore maintenance lock. Do **not** remove
  `FEST_RESET_MAINTENANCE` or delete `settings/resetMaintenance` manually.
  Inspect the backup and live inventories and complete recovery under
  maintenance mode.
- Keep `backups/production_fest_reset_*` in a secure, access-controlled
  location. Firebase Auth export includes account metadata and custom claims,
  not passwords or recoverable password hashes.
- After a successful reset, remove `FEST_RESET_MAINTENANCE` from the Production
  environment in Vercel and redeploy. The script has already cleared the
  temporary Firestore lock. Normal API and client writes resume after that
  production deployment.

**Never run this utility with a demo/emulator project ID, a staging credential,
a different Storage bucket, or from a non-interactive shell.**
