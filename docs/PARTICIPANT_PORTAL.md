# Participant Portal — deployment and privacy notes

## Participant identity and login

- Route: `/participant/login`, credentials: exact full `participants/{id}` (for example `part-<uuid>`) and the `dob` value in ISO `YYYY-MM-DD` format.
- Every existing and future participant created by Admin or an authorized Team Manager automatically qualifies; **no participant Firebase Auth user is created**.
- The shorter public bib number is intentionally **not** accepted as the login identifier.
- Sessions are HMAC-signed, scoped to `/api/participant`, HttpOnly, Secure in production, SameSite Strict, expiring after one hour.
- Per-ID (five attempts / fifteen minutes) and per-IP (four hundred attempts / fifteen minutes; shared-campus NAT capacity) rate limits use authoritative Firestore transactions. Repeated legitimate successful logins also count toward the attempt cap in this first iteration.
- The private participant API never returns DOB, email, or phone and never accepts a client-supplied participant ID after login.
- Access can be manually disabled for an individual by setting `participants/{id}.portalDisabled = true`. Removal of the participant also invalidates subsequent API requests.

**Important:** DOB is not a true password and may be known to classmates/family. The login requested here is suitable only for a tightly limited **read-only, low-sensitivity portal**. For minors or any more-sensitive data, add a one-time activation PIN or verified guardian OTP before production release. Never grant `PARTICIPANT` access to privileged Firestore writes or unpublished marks.

## Mandatory environment configuration

Set a **separate**, cryptographically random **32+ character** secret named:

`PARTICIPANT_SESSION_SECRET`

in the Vercel project's **Preview** and **Production** environments. Keep it server-side only (do **not** use a `NEXT_PUBLIC_` prefix). Generate with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Do not commit the generated value to GitHub. Redeploy after setting the variable; rotating it signs out existing participant sessions. Existing QR badge signing still requires the independently configured `QR_SIGNING_SECRET`.

## Data ownership

`/api/participant/me` reads only registrations with the session participant's ID in `participantId`, `groupLeaderId`, or legacy `groupMembers`. It fetches competition details and **PUBLISHED** result ranks linked to those registrations; no draft scores are returned. Group entry scores credit the team only, never the participant's personal total. No client Firestore reads/writes are required for the participant session.

`/api/participant/qr` signs the same server-verifiable accreditation QR used by Green Room, strictly for the authenticated participant.

## Required verification before merge

1. In the Firebase emulator, test correct/wrong DOB, unknown participant IDs, brute-force lockout, tampered/expired cookies, logout, deleted/disabled profiles.
2. With 2 participant accounts in separate browser sessions, confirm participant A cannot query B's profile, registrations or QR.
3. Confirm SOLO published result points match official points ledger; GROUP wins appear with **team-only** points and do not increase individual totals.
4. Confirm an unpublished/revised result disappears from the personal scoreboard and reappears only after official republishing.
5. Confirm digitally signed ID card downloads and valid QR scans work with Staff Green Room check-in.
6. Check privacy headers, cross-device experience, responsive layout and team-manager/Admin auth remain unchanged.
7. Run unit tests, Firebase emulator integration tests, and the Next.js production build; validate Vercel Preview end-to-end before merge.

Do not deploy to Production or alter Firebase Security Rules without separate review. Firestore server reads use the existing Admin SDK but **do not** grant client-side access to other participants' documents.
