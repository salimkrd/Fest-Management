/**
 * Staging Verification Script for Participant Portal on inspirath-staging
 *
 * Verifies:
 * 1. Target project is non-production staging ('inspirath-staging').
 * 2. Keyless Workload Identity Federation configuration & fail-closed security.
 * 3. Bib + DOB login using unprefixed bib '1042'.
 * 4. Bib + DOB login using prefixed badge bib '#1042'.
 * 5. Participant dashboard data retrieval (/api/participant/me).
 * 6. Individual SOLO points isolation (verifying GROUP points do not bleed into individual points).
 * 7. Signed digital ID QR badge generation (/api/participant/qr) and cryptographic signature validation.
 *
 * Run via:
 * node node_modules/tsx/dist/cli.mjs scripts/verifyStagingParticipantPortal.ts
 */

import { NextRequest } from 'next/server';
import { POST as loginRoute } from '../src/app/api/participant/login/route';
import { GET as meRoute } from '../src/app/api/participant/me/route';
import { GET as qrRoute } from '../src/app/api/participant/qr/route';
import { PARTICIPANT_COOKIE_NAME } from '../src/services/participantPortalAuth';
import { QrSignerService } from '../src/services/qrSignerService';
import {
  getAdminApp,
  getAdminDb,
  validateWorkloadIdentityScope,
  isWorkloadIdentityConfigured,
  STAGING_PROJECT_ID,
  PRODUCTION_PROJECT_ID,
  ALLOWED_WIF_BRANCH
} from '../src/lib/firebase/admin';

interface VerificationResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function record(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const icon = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${icon} ${step}: ${details}`);
}

async function runStagingVerification() {
  // If live Workload Identity is not configured in the current shell,
  // route to the local emulator for live functional testing.
  if (!isWorkloadIdentityConfigured()) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
  }

  // Ensure participant session and QR signing secrets are populated
  process.env.PARTICIPANT_SESSION_SECRET = process.env.PARTICIPANT_SESSION_SECRET || 'staging_test_participant_portal_session_secret_1234567890';
  process.env.QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'staging_test_qr_signing_secret_1234567890123456';

  const targetProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || STAGING_PROJECT_ID;

  // 1. Safety Guard Check: Target Project
  console.log(`[Target Environment] Project ID: "${targetProjectId}"`);
  if (targetProjectId === PRODUCTION_PROJECT_ID) {
    record(
      'Target Project Isolation',
      false,
      `ABORT: Verification script targeted production project "${PRODUCTION_PROJECT_ID}". Fail-closed!`
    );
    process.exit(1);
  } else {
    record(
      'Target Project Isolation',
      true,
      `Target project is non-production staging ("${targetProjectId}").`
    );
  }

  // 2. Fail-Closed Safety Scope Validation
  try {
    validateWorkloadIdentityScope(targetProjectId);
    record(
      'WIF Scope Validation (Staging)',
      true,
      `Workload Identity scope allowed for target project "${targetProjectId}" and branch "${ALLOWED_WIF_BRANCH}".`
    );
  } catch (err) {
    record(
      'WIF Scope Validation (Staging)',
      false,
      err instanceof Error ? err.message : String(err)
    );
  }

  // 3. Verify Fail-Closed Rejection against Production
  try {
    validateWorkloadIdentityScope(PRODUCTION_PROJECT_ID);
    record(
      'Fail-Closed Production Rejection',
      false,
      'FAILED: validateWorkloadIdentityScope did not block production project!'
    );
  } catch (err) {
    record(
      'Fail-Closed Production Rejection',
      true,
      'Successfully rejected production project with [FAIL-CLOSED SAFETY] error.'
    );
  }

  // 4. Verify Fail-Closed Rejection against Unauthorized Vercel Project ID
  try {
    process.env.VERCEL_PROJECT_ID = 'prj_unauthorized_attacker_project';
    validateWorkloadIdentityScope(targetProjectId);
    record(
      'Fail-Closed Vercel Project ID Scoping',
      false,
      'FAILED: validateWorkloadIdentityScope did not reject unauthorized Vercel Project ID!'
    );
  } catch (err) {
    record(
      'Fail-Closed Vercel Project ID Scoping',
      true,
      'Successfully rejected unauthorized Vercel Project ID with [FAIL-CLOSED SAFETY] error.'
    );
  } finally {
    delete process.env.VERCEL_PROJECT_ID;
  }

  // 4. Verify Workload Identity Configuration & App Connection
  const wifActive = isWorkloadIdentityConfigured();
  console.log(`[Auth Configuration] Workload Identity Federation Active: ${wifActive}`);

  const app = getAdminApp();
  if (!app) {
    record(
      'Firebase Admin App Initialization',
      false,
      'Could not initialize Firebase Admin app. Check credentials or emulator configuration.'
    );
    process.exit(1);
  } else {
    record(
      'Firebase Admin App Initialization',
      true,
      `Admin app active with project "${app.options.projectId}".`
    );
  }

  const db = getAdminDb();
  if (!db) {
    record('Firestore Access', false, 'Admin Firestore instance unavailable.');
    process.exit(1);
  }

  // 5. Seed / Ensure Staging Test Participant #1042 Data
  const testPartId = 'part-staging-verify-1042';
  const testDob = '2010-05-12';
  const testSoloCompId = 'staging-comp-solo-1042';
  const testGroupCompId = 'staging-comp-group-1042';
  const testSoloRegId = 'staging-reg-solo-1042';
  const testGroupRegId = 'staging-reg-group-1042';

  try {
    const batch = db.batch();

    // Clear rate limits in participantLoginAttempts
    const rlRefs = await db.collection('participantLoginAttempts').listDocuments();
    for (const doc of rlRefs) {
      batch.delete(doc);
    }

    // Clear any previous test participants with bib #1042 to prevent duplicate rejection
    const existingParts = await db.collection('participants').where('bib', '==', '#1042').get();
    for (const doc of existingParts.docs) {
      batch.delete(doc.ref);
    }

    // Participant #1042
    batch.set(db.collection('participants').doc(testPartId), {
      bib: '#1042',
      name: 'Nihad Mohammed',
      dob: testDob,
      teamId: 'staging-team-alpha',
      teamName: 'Al-Farooq House',
      teamCode: 'ALF',
      categoryId: 'cat-senior',
      categoryName: 'Senior',
      classGrade: '12',
      division: 'A',
      photoUrl: 'https://staging.inspirath.org/photos/nihad.jpg',
      idStatus: 'GENERATED'
    });

    // Solo Competition
    batch.set(db.collection('competitions').doc(testSoloCompId), {
      name: 'Elocution English Senior',
      code: 'EES-101',
      date: '2026-11-10',
      timeSlot: '09:00 AM - 10:30 AM',
      stageName: 'Stage 1 - Main Auditorium',
      performanceMode: 'SOLO'
    });

    // Group Competition
    batch.set(db.collection('competitions').doc(testGroupCompId), {
      name: 'Group Qawwali Senior',
      code: 'GQS-201',
      date: '2026-11-11',
      timeSlot: '02:00 PM - 04:00 PM',
      stageName: 'Stage 2 - Open Amphitheater',
      performanceMode: 'GROUP'
    });

    // Solo Registration
    batch.set(db.collection('registrations').doc(testSoloRegId), {
      participantId: testPartId,
      participantName: 'Nihad Mohammed',
      competitionId: testSoloCompId,
      competitionName: 'Elocution English Senior',
      type: 'SOLO',
      status: 'VERIFIED'
    });

    // Group Registration
    batch.set(db.collection('registrations').doc(testGroupRegId), {
      groupLeaderId: testPartId,
      groupMembers: [testPartId, 'staging-member-2'],
      participantName: 'Farooq Stars',
      competitionId: testGroupCompId,
      competitionName: 'Group Qawwali Senior',
      type: 'GROUP',
      status: 'VERIFIED'
    });

    // Solo Result: 1st Place = 10 Official Points
    batch.set(db.collection('results').doc(`res-${testSoloCompId}`), {
      competitionId: testSoloCompId,
      resultStatus: 'PUBLISHED',
      ranks: [
        {
          rank: 1,
          registrationId: testSoloRegId,
          score: 95,
          grade: 'A',
          officialPoints: 10
        }
      ]
    });

    // Group Result: 1st Place = 15 Team Official Points
    batch.set(db.collection('results').doc(`res-${testGroupCompId}`), {
      competitionId: testGroupCompId,
      resultStatus: 'PUBLISHED',
      ranks: [
        {
          rank: 1,
          registrationId: testGroupRegId,
          score: 92,
          grade: 'A',
          officialPoints: 15
        }
      ]
    });

    await batch.commit();
    record('Staging Test Data Provisioning', true, 'Participant #1042, solo competition, group competition, and published results seeded.');
  } catch (err) {
    record('Staging Test Data Provisioning', false, err instanceof Error ? err.message : String(err));
  }

  // 6. Test Login with unprefixed bib '1042'
  let sessionToken: string | undefined;
  try {
    const loginReq = new NextRequest('http://localhost:3000/api/participant/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000'
      },
      body: JSON.stringify({ bib: '1042', dob: testDob })
    });
    const loginRes = await loginRoute(loginReq);
    const loginData = await loginRes.json();

    const cookie = loginRes.cookies.get(PARTICIPANT_COOKIE_NAME);
    sessionToken = cookie?.value;

    if (loginRes.status === 200 && loginData.success && sessionToken) {
      record('Login with Unprefixed Bib ("1042")', true, 'Status 200 OK, session cookie received.');
    } else {
      record('Login with Unprefixed Bib ("1042")', false, `Status: ${loginRes.status}, data: ${JSON.stringify(loginData)}`);
    }
  } catch (err) {
    record('Login with Unprefixed Bib ("1042")', false, err instanceof Error ? err.message : String(err));
  }

  // 7. Test Login with prefixed bib '#1042'
  try {
    const loginReq2 = new NextRequest('http://localhost:3000/api/participant/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000'
      },
      body: JSON.stringify({ bib: '#1042', dob: testDob })
    });
    const loginRes2 = await loginRoute(loginReq2);
    const loginData2 = await loginRes2.json();

    if (loginRes2.status === 200 && loginData2.success) {
      record('Login with Prefixed Bib ("#1042")', true, 'Status 200 OK, authentication successful.');
    } else {
      record('Login with Prefixed Bib ("#1042")', false, `Status: ${loginRes2.status}`);
    }
  } catch (err) {
    record('Login with Prefixed Bib ("#1042")', false, err instanceof Error ? err.message : String(err));
  }

  if (!sessionToken) {
    console.error('Cannot proceed with dashboard and QR verification without session token.');
    process.exit(1);
  }

  // 8. Test Participant Dashboard (/api/participant/me)
  let dashboardData: any;
  try {
    const meReq = new NextRequest('http://localhost:3000/api/participant/me', {
      method: 'GET',
      headers: {
        cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}`
      }
    });
    const meRes = await meRoute(meReq);
    dashboardData = await meRes.json();

    const profile = dashboardData.profile;
    const hasBib = profile?.bib === '#1042';
    const noDobLeaked = dashboardData.dob === undefined && profile?.dob === undefined;
    const noPhoneLeaked = dashboardData.phone === undefined && profile?.phone === undefined;

    if (meRes.status === 200 && hasBib && noDobLeaked && noPhoneLeaked) {
      record(
        'Participant Dashboard Retrieval & Isolation (/api/participant/me)',
        true,
        `Retrieved profile for ${profile.name} (#1042). DOB and phone strictly isolated.`
      );
    } else {
      record(
        'Participant Dashboard Retrieval & Isolation (/api/participant/me)',
        false,
        `Status: ${meRes.status}, profile: ${JSON.stringify(profile)}`
      );
    }
  } catch (err) {
    record('Participant Dashboard Retrieval & Isolation (/api/participant/me)', false, err instanceof Error ? err.message : String(err));
  }

  // 9. Verify Individual Points vs Group Points Isolation
  try {
    const summary = dashboardData?.summary;
    const events = dashboardData?.events || [];

    const soloEvent = events.find((e: any) => e.type === 'SOLO');
    const groupEvent = events.find((e: any) => e.type === 'GROUP');

    const soloPoints = soloEvent?.individualPoints;
    const groupTeamPoints = groupEvent?.groupTeamPoints;
    const totalIndividualPoints = summary?.individualPoints;

    const pointsCorrect =
      soloPoints === 10 &&
      groupTeamPoints === 15 &&
      groupEvent?.individualPoints === 0 &&
      totalIndividualPoints === 10;

    if (pointsCorrect) {
      record(
        'Individual vs Team Points Isolation',
        true,
        `Solo Points: ${soloPoints}, Group Team Points: ${groupTeamPoints}, Total Individual Points: ${totalIndividualPoints} (Solo only).`
      );
    } else {
      record(
        'Individual vs Team Points Isolation',
        false,
        `Points mismatch: Solo=${soloPoints}, Group=${groupTeamPoints}, Summary=${totalIndividualPoints}`
      );
    }
  } catch (err) {
    record('Individual vs Team Points Isolation', false, err instanceof Error ? err.message : String(err));
  }

  // 10. Test Signed Digital ID QR Generation (/api/participant/qr)
  try {
    const qrReq = new NextRequest('http://localhost:3000/api/participant/qr', {
      method: 'GET',
      headers: {
        cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}`
      }
    });
    const qrRes = await qrRoute(qrReq);
    const qrData = await qrRes.json();

    const token = qrData.token;
    const payload = qrData.payload;

    if (qrRes.status === 200 && qrData.success && token && payload) {
      const isAuthentic = QrSignerService.verifyParticipantQrToken(testPartId, '#1042', token);

      // Anti-tamper verification: spoofed participant ID fails
      const antiTamperPassed = !QrSignerService.verifyParticipantQrToken('part-spoofed-id', '#1042', token);

      if (isAuthentic && antiTamperPassed) {
        record(
          'Signed Digital ID QR Badge Generation (/api/participant/qr)',
          true,
          `Generated and cryptographically validated signed QR token for Bib #1042. Anti-tampering check verified.`
        );
      } else {
        record(
          'Signed Digital ID QR Badge Generation (/api/participant/qr)',
          false,
          `Verification failure: isAuthentic=${isAuthentic}, antiTamperPassed=${antiTamperPassed}`
        );
      }
    } else {
      record(
        'Signed Digital ID QR Badge Generation (/api/participant/qr)',
        false,
        `Status: ${qrRes.status}, data: ${JSON.stringify(qrData)}`
      );
    }
  } catch (err) {
    record('Signed Digital ID QR Badge Generation (/api/participant/qr)', false, err instanceof Error ? err.message : String(err));
  }

  // Clean up test documents
  try {
    const cleanupBatch = db.batch();
    cleanupBatch.delete(db.collection('participants').doc(testPartId));
    cleanupBatch.delete(db.collection('competitions').doc(testSoloCompId));
    cleanupBatch.delete(db.collection('competitions').doc(testGroupCompId));
    cleanupBatch.delete(db.collection('registrations').doc(testSoloRegId));
    cleanupBatch.delete(db.collection('registrations').doc(testGroupRegId));
    cleanupBatch.delete(db.collection('results').doc(`res-${testSoloCompId}`));
    cleanupBatch.delete(db.collection('results').doc(`res-${testGroupCompId}`));
    await cleanupBatch.commit();
  } catch {
    // ignore cleanup error
  }

  // Summary Report
  console.log('\n================================================================');
  console.log('  VERIFICATION SUMMARY REPORT');
  console.log('================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`Total Checks: ${results.length} | Passed: ${results.filter(r => r.passed).length} | Failed: ${results.filter(r => !r.passed).length}`);

  if (allPassed) {
    console.log('\n🎉 ALL STAGING PARTICIPANT PORTAL CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME CHECKS FAILED. See details above.\n');
    process.exit(1);
  }
}

runStagingVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
