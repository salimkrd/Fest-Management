import { describe, beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { POST as loginRoute } from '@/app/api/participant/login/route';
import { POST as logoutRoute } from '@/app/api/participant/logout/route';
import { GET as meRoute } from '@/app/api/participant/me/route';
import { GET as qrRoute } from '@/app/api/participant/qr/route';
import { createHash } from 'node:crypto';
import { normalizeBib, PARTICIPANT_COOKIE_NAME } from '@/services/participantPortalAuth';
import { QrSignerService } from '@/services/qrSignerService';
import { verifyQrVerificationToken } from '@/domain/greenRoom';

const TEST_SECRET = 'inspirath_production_safe_server_only_participant_portal_session_secret_2026';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

describe('Participant Portal Emulator End-to-End Integration Tests', () => {
  const db = getAdminDb()!;
  const testPartIdA = 'part-portal-test-1042';
  const testPartIdB = 'part-portal-test-1043';
  const testPartIdDup = 'part-portal-test-dup';

  const testCompSoloId = 'comp-portal-solo-1';
  const testCompGroupId = 'comp-portal-group-1';
  const testCompDraftId = 'comp-portal-draft-1';

  const testRegSoloId = 'reg-portal-solo-1';
  const testRegGroupId = 'reg-portal-group-1';
  const testRegDraftId = 'reg-portal-draft-1';

  const testResultSoloId = 'res-portal-solo-1';
  const testResultGroupId = 'res-portal-group-1';
  const testResultDraftId = 'res-portal-draft-1';

  beforeAll(async () => {
    process.env.PARTICIPANT_SESSION_SECRET = TEST_SECRET;

    // 1. Seed Participant A (#1042)
    await db.collection('participants').doc(testPartIdA).set({
      id: testPartIdA,
      bib: '#1042',
      name: 'Rayan Siddiqui',
      email: 'rayan.private@secret.org',
      phone: '+91 99999 11111',
      dob: '2008-04-12',
      teamId: 'team-1',
      teamCode: 'SHA',
      teamName: 'Al-Shamama',
      categoryId: 'cat-3',
      categoryName: 'Senior',
      classGrade: 'Grade 12',
      division: 'A',
      photoUrl: 'https://example.com/photo-1042.jpg',
      idStatus: 'ISSUED',
      registeredEventIds: [testCompSoloId, testCompGroupId, testCompDraftId],
      remarks: 'Confidential administrative note'
    });

    // 2. Seed Participant B (#1043)
    await db.collection('participants').doc(testPartIdB).set({
      id: testPartIdB,
      bib: '#1043',
      name: 'Zaid Al-Harith',
      email: 'zaid.private@secret.org',
      phone: '+91 88888 22222',
      dob: '2008-07-20',
      teamId: 'team-2',
      teamCode: 'NAW',
      teamName: 'An-Nawa',
      categoryId: 'cat-3',
      categoryName: 'Senior',
      classGrade: 'Grade 12',
      division: 'B',
      photoUrl: 'https://example.com/photo-1043.jpg',
      idStatus: 'ISSUED',
      registeredEventIds: []
    });

    // 3. Seed Competitions
    await db.collection('competitions').doc(testCompSoloId).set({
      id: testCompSoloId,
      name: 'Solo English Elocution',
      code: 'ELO-SR',
      type: 'SOLO',
      date: '2025-10-25',
      timeSlot: '10:00 AM',
      stageName: 'Stage 1',
      performanceMode: 'STAGE',
      status: 'PUBLISHED'
    });

    await db.collection('competitions').doc(testCompGroupId).set({
      id: testCompGroupId,
      name: 'Group Qawwali Performance',
      code: 'QAW-SR',
      type: 'GROUP',
      date: '2025-10-25',
      timeSlot: '02:00 PM',
      stageName: 'Main Auditorium',
      performanceMode: 'STAGE',
      status: 'PUBLISHED'
    });

    await db.collection('competitions').doc(testCompDraftId).set({
      id: testCompDraftId,
      name: 'Calligraphy Championship',
      code: 'CAL-SR',
      type: 'SOLO',
      date: '2025-10-26',
      timeSlot: '11:00 AM',
      stageName: 'Art Hall',
      performanceMode: 'OFF_STAGE',
      status: 'IN_PROGRESS'
    });

    // 4. Seed Registrations for Participant A
    await db.collection('registrations').doc(testRegSoloId).set({
      id: testRegSoloId,
      competitionId: testCompSoloId,
      competitionName: 'Solo English Elocution',
      type: 'SOLO',
      participantId: testPartIdA,
      participantName: 'Rayan Siddiqui',
      teamId: 'team-1',
      status: 'APPROVED'
    });

    await db.collection('registrations').doc(testRegGroupId).set({
      id: testRegGroupId,
      competitionId: testCompGroupId,
      competitionName: 'Group Qawwali Performance',
      type: 'GROUP',
      participantId: testPartIdA,
      groupLeaderId: testPartIdA,
      participantName: 'Shamama Qawwali Troupe',
      teamId: 'team-1',
      status: 'APPROVED'
    });

    await db.collection('registrations').doc(testRegDraftId).set({
      id: testRegDraftId,
      competitionId: testCompDraftId,
      competitionName: 'Calligraphy Championship',
      type: 'SOLO',
      participantId: testPartIdA,
      participantName: 'Rayan Siddiqui',
      teamId: 'team-1',
      status: 'APPROVED'
    });

    // 5. Seed Results
    // Solo Result: PUBLISHED, Rank 1 -> 10 official points
    await db.collection('results').doc(testResultSoloId).set({
      id: testResultSoloId,
      competitionId: testCompSoloId,
      resultStatus: 'PUBLISHED',
      ranks: [
        {
          registrationId: testRegSoloId,
          bib: '#1042',
          candidateName: 'Rayan Siddiqui',
          teamId: 'team-1',
          teamCode: 'SHA',
          score: 95,
          grade: 'A+',
          rank: 1,
          officialPoints: 11,
          totalEarnedPoints: 11
        }
      ]
    });

    // Group Result: PUBLISHED, Rank 1 -> 23 team points (Grade A+ for 92 marks in GROUP is 23 points)
    await db.collection('results').doc(testResultGroupId).set({
      id: testResultGroupId,
      competitionId: testCompGroupId,
      resultStatus: 'PUBLISHED',
      ranks: [
        {
          registrationId: testRegGroupId,
          bib: '#1042',
          candidateName: 'Shamama Qawwali Troupe',
          teamId: 'team-1',
          teamCode: 'SHA',
          score: 92,
          grade: 'A+',
          rank: 1,
          officialPoints: 23,
          totalEarnedPoints: 23
        }
      ]
    });

    // Draft Result: READY_FOR_REVIEW (Unpublished), score 88 -> Grade A, Rank 2 -> 8 points
    await db.collection('results').doc(testResultDraftId).set({
      id: testResultDraftId,
      competitionId: testCompDraftId,
      resultStatus: 'READY_FOR_REVIEW',
      ranks: [
        {
          registrationId: testRegDraftId,
          bib: '#1042',
          candidateName: 'Rayan Siddiqui',
          teamId: 'team-1',
          teamCode: 'SHA',
          score: 88,
          grade: 'A',
          rank: 2,
          officialPoints: 8,
          totalEarnedPoints: 8
        }
      ]
    });
  });

  afterAll(async () => {
    // Clean up test documents from emulator
    const cleanupDocs = [
      db.collection('participants').doc(testPartIdA),
      db.collection('participants').doc(testPartIdB),
      db.collection('participants').doc(testPartIdDup),
      db.collection('competitions').doc(testCompSoloId),
      db.collection('competitions').doc(testCompGroupId),
      db.collection('competitions').doc(testCompDraftId),
      db.collection('registrations').doc(testRegSoloId),
      db.collection('registrations').doc(testRegGroupId),
      db.collection('registrations').doc(testRegDraftId),
      db.collection('results').doc(testResultSoloId),
      db.collection('results').doc(testResultGroupId),
      db.collection('results').doc(testResultDraftId)
    ];
    await Promise.allSettled(cleanupDocs.map(ref => ref.delete()));
  });

  async function clearRateLimits(bib: string, ip: string = '192.168.1.100') {
    const bibKey = 'bib-' + digest(normalizeBib(bib) || bib);
    const ipKey = 'ip-' + digest(ip);
    await Promise.allSettled([
      db.collection('participantLoginAttempts').doc(bibKey).delete(),
      db.collection('participantLoginAttempts').doc(ipKey).delete()
    ]);
  }

  function createPostRequest(url: string, body: unknown, ip: string = '192.168.1.100') {
    return new NextRequest(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': ip,
        origin: new URL(url).origin
      },
      body: JSON.stringify(body)
    });
  }

  function createGetRequest(url: string, cookieValue?: string) {
    const headers: Record<string, string> = {};
    if (cookieValue) {
      headers['cookie'] = `${PARTICIPANT_COOKIE_NAME}=${cookieValue}`;
    }
    return new NextRequest(url, {
      method: 'GET',
      headers
    });
  }

  describe('1. Short Bib Number + DOB Authentication Tests', () => {
    beforeEach(async () => {
      await clearRateLimits('#1042');
    });

    it('successfully signs in with unprefixed bib "1042" and valid DOB', async () => {
      const req = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '1042',
        dob: '2008-04-12'
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const cookie = res.cookies.get(PARTICIPANT_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('strict');
      expect(cookie?.path).toBe('/api/participant');
    });

    it('successfully signs in with prefixed bib "#1042" as printed on physical ID badge', async () => {
      const req = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '#1042',
        dob: '2008-04-12'
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('successfully signs in with numeric bib 1042 and padded strings', async () => {
      const req1 = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: 1042,
        dob: '2008-04-12'
      });
      const res1 = await loginRoute(req1);
      expect(res1.status).toBe(200);

      const req2 = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '  #1042  ',
        dob: '2008-04-12'
      });
      const res2 = await loginRoute(req2);
      expect(res2.status).toBe(200);
    });

    it('rejects incorrect DOB with HTTP 401', async () => {
      const req = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '1042',
        dob: '2008-04-13' // 1 day off
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid Bib Number or Date of Birth.');
    });

    it('rejects malformed or invalid calendar dates (e.g. Feb 31, non-ISO)', async () => {
      const req1 = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '1042',
        dob: '2008-02-31'
      });
      expect((await loginRoute(req1)).status).toBe(401);

      const req2 = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '1042',
        dob: '12-04-2008'
      });
      expect((await loginRoute(req2)).status).toBe(401);
    });

    it('rejects unknown bib numbers with uniform HTTP 401 message (no user enumeration)', async () => {
      const req = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '9999',
        dob: '2008-04-12'
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid Bib Number or Date of Birth.');
    });
  });

  describe('2. Duplicate Bib Number Rejection (Fail-Closed)', () => {
    it('strictly rejects authentication when two participants share the same Bib number', async () => {
      await clearRateLimits('#1042');
      // Temporarily seed a duplicate participant with the exact same bib #1042
      await db.collection('participants').doc(testPartIdDup).set({
        id: testPartIdDup,
        bib: '#1042',
        name: 'Colliding Participant',
        dob: '2008-04-12',
        teamId: 'team-3',
        status: 'ACTIVE'
      });

      try {
        const req = createPostRequest('http://localhost:3000/api/participant/login', {
          bib: '1042',
          dob: '2008-04-12'
        });
        const res = await loginRoute(req);
        // Must fail closed (401) rather than guessing or picking one arbitrarily
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('Invalid Bib Number or Date of Birth.');
      } finally {
        await db.collection('participants').doc(testPartIdDup).delete();
      }

      // After removing the duplicate, single login works again
      const restoredReq = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '1042',
        dob: '2008-04-12'
      });
      expect((await loginRoute(restoredReq)).status).toBe(200);
    });
  });

  describe('3. Rate Limiting Safeguards', () => {
    it('enforces brute force rate limiting after 5 attempts on a Bib', async () => {
      const targetBib = '8888';
      const dedicatedIp = '10.99.88.77';
      await clearRateLimits('#8888', dedicatedIp);

      // Seed a test participant for rate limit testing
      const rateLimitPartId = 'part-ratelimit-target';
      await db.collection('participants').doc(rateLimitPartId).set({
        id: rateLimitPartId,
        bib: '#8888',
        name: 'Rate Limit Target',
        dob: '2009-01-01'
      });

      try {
        // Send 5 incorrect attempts
        for (let i = 0; i < 5; i++) {
          const req = createPostRequest('http://localhost:3000/api/participant/login', {
            bib: targetBib,
            dob: '2000-01-01'
          }, dedicatedIp);
          const res = await loginRoute(req);
          expect(res.status).toBe(401);
        }

        // 6th attempt even with correct credentials must be rate limited (429)
        const lockedReq = createPostRequest('http://localhost:3000/api/participant/login', {
          bib: targetBib,
          dob: '2009-01-01'
        }, dedicatedIp);
        const lockedRes = await loginRoute(lockedReq);
        expect(lockedRes.status).toBe(429);
        const lockedData = await lockedRes.json();
        expect(lockedData.error).toContain('Too many sign-in attempts');
      } finally {
        await db.collection('participants').doc(rateLimitPartId).delete();
      }
    });

    it('permits legitimate repeat logins (6+ consecutive logins) without rate-limit lockout', async () => {
      const dedicatedIp = '10.99.88.78';
      await clearRateLimits('#1042', dedicatedIp);

      // Execute 8 consecutive legitimate logins with correct Bib and DOB
      for (let i = 0; i < 8; i++) {
        const req = createPostRequest('http://localhost:3000/api/participant/login', {
          bib: '1042',
          dob: '2008-04-12'
        }, dedicatedIp);
        const res = await loginRoute(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      }
    });

    it('throttles unknown Bib enumeration after 5 failed attempts', async () => {
      const dedicatedIp = '10.99.88.79';
      const unknownBib = '99999';
      await clearRateLimits('#99999', dedicatedIp);

      for (let i = 0; i < 5; i++) {
        const req = createPostRequest('http://localhost:3000/api/participant/login', {
          bib: unknownBib,
          dob: '2008-04-12'
        }, dedicatedIp);
        const res = await loginRoute(req);
        expect(res.status).toBe(401);
      }

      // 6th attempt is throttled
      const req6 = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: unknownBib,
        dob: '2008-04-12'
      }, dedicatedIp);
      const res6 = await loginRoute(req6);
      expect(res6.status).toBe(429);
    });
  });

  describe('4. Session Tampering & Invalidation Protections', () => {
    let validToken: string;

    beforeAll(async () => {
      await clearRateLimits('#1042');
      const loginReq = createPostRequest('http://localhost:3000/api/participant/login', {
        bib: '1042',
        dob: '2008-04-12'
      });
      const loginRes = await loginRoute(loginReq);
      validToken = loginRes.cookies.get(PARTICIPANT_COOKIE_NAME)!.value;
    });

    it('rejects tampered cookie payloads and forged signatures with HTTP 401', async () => {
      const [payload, sig] = validToken.split('.');
      const forgedSig = sig.slice(0, -2) + (sig.endsWith('aa') ? 'bb' : 'aa');
      const tamperedToken = `${payload}.${forgedSig}`;

      const req = createGetRequest('http://localhost:3000/api/participant/me', tamperedToken);
      const res = await meRoute(req);
      expect(res.status).toBe(401);
    });

    it('rejects access when participant account has portalDisabled: true', async () => {
      await db.collection('participants').doc(testPartIdA).update({ portalDisabled: true });
      try {
        const req = createGetRequest('http://localhost:3000/api/participant/me', validToken);
        const res = await meRoute(req);
        expect(res.status).toBe(401);
      } finally {
        await db.collection('participants').doc(testPartIdA).update({ portalDisabled: false });
      }
    });

    it('clears the participant session on logout', async () => {
      const logoutReq = createPostRequest('http://localhost:3000/api/participant/logout', {});
      const logoutRes = await logoutRoute(logoutReq);
      expect(logoutRes.status).toBe(200);

      const cookie = logoutRes.cookies.get(PARTICIPANT_COOKIE_NAME);
      expect(cookie?.maxAge).toBe(0);
    });
  });

  describe('5. Data Isolation & Privacy Boundary Enforcement', () => {
    let sessionTokenA: string;
    let sessionTokenB: string;

    beforeAll(async () => {
      await clearRateLimits('#1042', '10.0.1.1');
      await clearRateLimits('#1043', '10.0.1.2');
      const reqA = createPostRequest('http://localhost:3000/api/participant/login', { bib: '1042', dob: '2008-04-12' }, '10.0.1.1');
      const resA = await loginRoute(reqA);
      sessionTokenA = resA.cookies.get(PARTICIPANT_COOKIE_NAME)!.value;

      const reqB = createPostRequest('http://localhost:3000/api/participant/login', { bib: '1043', dob: '2008-07-20' }, '10.0.1.2');
      const resB = await loginRoute(reqB);
      sessionTokenB = resB.cookies.get(PARTICIPANT_COOKIE_NAME)!.value;
    });

    it('Participant A receives only their own profile and competitions', async () => {
      const req = createGetRequest('http://localhost:3000/api/participant/me', sessionTokenA);
      const res = await meRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.profile.id).toBe(testPartIdA);
      expect(data.profile.name).toBe('Rayan Siddiqui');
      expect(data.profile.bib).toBe('#1042');
      expect(data.profile.teamName).toBe('Al-Shamama');

      // Privacy: Sensitive fields MUST NEVER be exposed in the response
      expect(data.profile.email).toBeUndefined();
      expect(data.profile.phone).toBeUndefined();
      expect(data.profile.dob).toBeUndefined();
      expect(data.profile.remarks).toBeUndefined();

      // Registrations belong to Participant A
      const eventIds = data.events.map((e: { registrationId: string }) => e.registrationId);
      expect(eventIds).toContain(testRegSoloId);
      expect(eventIds).toContain(testRegGroupId);
      expect(eventIds).toContain(testRegDraftId);
    });

    it('Participant B cannot access Participant A data even if query params are spoofed', async () => {
      // Spoofing query parameter ?participantId=part-portal-test-1042
      const req = createGetRequest(
        `http://localhost:3000/api/participant/me?participantId=${testPartIdA}`,
        sessionTokenB
      );
      const res = await meRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Must strictly return Participant B's profile, ignoring the client query param
      expect(data.profile.id).toBe(testPartIdB);
      expect(data.profile.bib).toBe('#1043');
      expect(data.profile.name).toBe('Zaid Al-Harith');
      expect(data.events).toHaveLength(0);
    });
  });

  describe('6. Scoring Invariants: Individual SOLO vs Team-Only GROUP Points', () => {
    let sessionTokenA: string;

    beforeAll(async () => {
      await clearRateLimits('#1042', '10.0.1.3');
      const reqA = createPostRequest('http://localhost:3000/api/participant/login', { bib: '1042', dob: '2008-04-12' }, '10.0.1.3');
      const resA = await loginRoute(reqA);
      sessionTokenA = resA.cookies.get(PARTICIPANT_COOKIE_NAME)!.value;
    });

    it('credits official points from SOLO published results to individual total', async () => {
      const req = createGetRequest('http://localhost:3000/api/participant/me', sessionTokenA);
      const res = await meRoute(req);
      const data = await res.json();

      const soloEvent = data.events.find((e: { registrationId: string }) => e.registrationId === testRegSoloId);
      expect(soloEvent).toBeDefined();
      expect(soloEvent.published).toBe(true);
      expect(soloEvent.type).toBe('SOLO');
      expect(soloEvent.score).toBe(95);
      expect(soloEvent.grade).toBe('A+');
      expect(soloEvent.position).toBe(1);
      expect(soloEvent.individualPoints).toBe(11);
      expect(soloEvent.groupTeamPoints).toBe(0);
    });

    it('marks GROUP competition wins as team-only points without inflating individual points', async () => {
      const req = createGetRequest('http://localhost:3000/api/participant/me', sessionTokenA);
      const res = await meRoute(req);
      const data = await res.json();

      const groupEvent = data.events.find((e: { registrationId: string }) => e.registrationId === testRegGroupId);
      expect(groupEvent).toBeDefined();
      expect(groupEvent.published).toBe(true);
      expect(groupEvent.type).toBe('GROUP');
      expect(groupEvent.score).toBe(92);
      expect(groupEvent.grade).toBe('A+');
      expect(groupEvent.position).toBe(1);
      expect(groupEvent.individualPoints).toBe(0); // MUST BE 0 FOR INDIVIDUAL
      expect(groupEvent.groupTeamPoints).toBe(23); // Team points credited

      // Overall summary individual points must reflect ONLY the SOLO points (11), NOT 34
      expect(data.summary.individualPoints).toBe(11);
    });

    it('hides unpublished/draft scores and marks from the participant portal', async () => {
      const req = createGetRequest('http://localhost:3000/api/participant/me', sessionTokenA);
      const res = await meRoute(req);
      const data = await res.json();

      const draftEvent = data.events.find((e: { registrationId: string }) => e.registrationId === testRegDraftId);
      expect(draftEvent).toBeDefined();
      expect(draftEvent.published).toBe(false);
      expect(draftEvent.score).toBeNull();
      expect(draftEvent.grade).toBeNull();
      expect(draftEvent.position).toBeNull();
      expect(draftEvent.individualPoints).toBe(0);
    });

    it('immediately hides score when result is unpublished, and restores upon republishing', async () => {
      // Unpublish solo result
      await db.collection('results').doc(testResultSoloId).update({ resultStatus: 'REVISION_REQUIRED' });

      let req = createGetRequest('http://localhost:3000/api/participant/me', sessionTokenA);
      let res = await meRoute(req);
      let data = await res.json();
      let soloEvent = data.events.find((e: { registrationId: string }) => e.registrationId === testRegSoloId);
      expect(soloEvent.published).toBe(false);
      expect(soloEvent.score).toBeNull();
      expect(data.summary.individualPoints).toBe(0);

      // Republish result
      await db.collection('results').doc(testResultSoloId).update({ resultStatus: 'PUBLISHED' });

      req = createGetRequest('http://localhost:3000/api/participant/me', sessionTokenA);
      res = await meRoute(req);
      data = await res.json();
      soloEvent = data.events.find((e: { registrationId: string }) => e.registrationId === testRegSoloId);
      expect(soloEvent.published).toBe(true);
      expect(soloEvent.score).toBe(95);
      expect(soloEvent.grade).toBe('A+');
      expect(data.summary.individualPoints).toBe(11);
    });
  });

  describe('7. Digital ID QR Signing & Accreditation Code Verification', () => {
    let sessionTokenA: string;

    beforeAll(async () => {
      await clearRateLimits('#1042', '10.0.1.4');
      const reqA = createPostRequest('http://localhost:3000/api/participant/login', { bib: '1042', dob: '2008-04-12' }, '10.0.1.4');
      const resA = await loginRoute(reqA);
      sessionTokenA = resA.cookies.get(PARTICIPANT_COOKIE_NAME)!.value;
    });

    it('generates a valid, cryptographically signed accreditation QR for the session participant', async () => {
      const req = createGetRequest('http://localhost:3000/api/participant/qr', sessionTokenA);
      const res = await qrRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.payload).toBeDefined();

      // Parse payload and verify contents
      const parsed = JSON.parse(data.payload);
      expect(parsed.app).toBe('INSPIRATH');
      expect(parsed.id).toBe(testPartIdA);
      expect(parsed.bib).toBe('#1042');
      expect(parsed.token).toBe(data.token);

      // Verify cryptographic authenticity via Green Room verification logic
      const qrSigningSecret = process.env.QR_SIGNING_SECRET!;
      const isValid = verifyQrVerificationToken(testPartIdA, '#1042', data.token, qrSigningSecret);
      expect(isValid).toBe(true);

      // Tampered ID or Bib fails verification
      expect(verifyQrVerificationToken('part-spoofed-id', '#1042', data.token, qrSigningSecret)).toBe(false);
      expect(verifyQrVerificationToken(testPartIdA, '#9999', data.token, qrSigningSecret)).toBe(false);
    });

    it('rejects QR request when no participant session is active', async () => {
      const req = createGetRequest('http://localhost:3000/api/participant/qr');
      const res = await qrRoute(req);
      expect(res.status).toBe(401);
    });
  });
});
