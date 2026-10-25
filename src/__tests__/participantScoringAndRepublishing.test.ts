import { describe, beforeAll, afterAll, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { POST as loginRoute } from '@/app/api/participant/login/route';
import { GET as meRoute } from '@/app/api/participant/me/route';
import { GET as qrRoute } from '@/app/api/participant/qr/route';
import { PARTICIPANT_COOKIE_NAME } from '@/services/participantPortalAuth';
import { QrSignerService } from '@/services/qrSignerService';
import { ParticipantPhoto } from '@/components/domain/ParticipantPhoto';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';

describe('Participant Portal Staging Scoring, Republishing & Digital ID Validation', () => {
  const db = getAdminDb()!;
  const runId = `test-scoring-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const testPartId = `part-${runId}`;
  const testBib = '#7711';
  const testDob = '2010-05-12';
  const testClientIp = '192.0.2.144';

  const testSoloCompId = `comp-solo-${runId}`;
  const testGroupCompId = `comp-group-${runId}`;
  const testSoloRegId = `reg-solo-${runId}`;
  const testGroupRegId = `reg-group-${runId}`;
  const testSoloResultDocId = `res-${testSoloCompId}`;
  const testGroupResultDocId = `res-${testGroupCompId}`;

  const createdDocRefs: FirebaseFirestore.DocumentReference[] = [];
  let initialParticipantCount = 0;
  let sessionToken: string;

  beforeAll(async () => {
    process.env.PARTICIPANT_SESSION_SECRET = 'inspirath_production_safe_server_only_participant_portal_session_secret_2026';
    process.env.QR_SIGNING_SECRET = 'inspirath_staging_test_qr_signing_secret_2026';

    // 1. Snapshot baseline participant count to verify non-destructive isolation
    const baseline = await db.collection('participants').get();
    initialParticipantCount = baseline.size;

    // 2. Provision isolated fixture without touching any existing participants
    const batch = db.batch();

    const partRef = db.collection('participants').doc(testPartId);
    batch.set(partRef, {
      bib: testBib,
      name: 'Nihad Mohammed',
      dob: testDob,
      teamId: `team-${runId}`,
      teamName: 'Al-Farooq House',
      teamCode: 'ALF',
      categoryId: `cat-${runId}`,
      categoryName: 'Senior',
      classGrade: 'Grade 12',
      division: 'A',
      photoUrl: '', // No photo uploaded - tests neutral placeholder
      idStatus: 'GENERATED'
    });
    createdDocRefs.push(partRef);

    const soloCompRef = db.collection('competitions').doc(testSoloCompId);
    batch.set(soloCompRef, {
      name: 'Elocution English Senior',
      code: 'EES-101',
      date: '2026-11-10',
      timeSlot: '09:00 AM - 10:30 AM',
      stageName: 'Stage 1',
      performanceMode: 'SOLO'
    });
    createdDocRefs.push(soloCompRef);

    const groupCompRef = db.collection('competitions').doc(testGroupCompId);
    batch.set(groupCompRef, {
      name: 'Group Qawwali Senior',
      code: 'GQS-201',
      date: '2026-11-11',
      timeSlot: '02:00 PM - 04:00 PM',
      stageName: 'Stage 2',
      performanceMode: 'GROUP'
    });
    createdDocRefs.push(groupCompRef);

    const soloRegRef = db.collection('registrations').doc(testSoloRegId);
    batch.set(soloRegRef, {
      participantId: testPartId,
      participantName: 'Nihad Mohammed',
      competitionId: testSoloCompId,
      competitionName: 'Elocution English Senior',
      type: 'SOLO',
      status: 'VERIFIED'
    });
    createdDocRefs.push(soloRegRef);

    const groupRegRef = db.collection('registrations').doc(testGroupRegId);
    batch.set(groupRegRef, {
      participantId: testPartId,
      groupLeaderId: testPartId,
      groupMembers: [testPartId, `member-${runId}`],
      participantName: 'Farooq Stars',
      competitionId: testGroupCompId,
      competitionName: 'Group Qawwali Senior',
      type: 'GROUP',
      status: 'VERIFIED'
    });
    createdDocRefs.push(groupRegRef);

    // Solo Result: PUBLISHED, Rank 1 -> 10 official points
    const soloResRef = db.collection('results').doc(testSoloResultDocId);
    batch.set(soloResRef, {
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
    createdDocRefs.push(soloResRef);

    // Group Result: PUBLISHED, Rank 1 -> 15 team official points
    const groupResRef = db.collection('results').doc(testGroupResultDocId);
    batch.set(groupResRef, {
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
    createdDocRefs.push(groupResRef);

    await batch.commit();

    // Authenticate and obtain session cookie
    const loginReq = new NextRequest('http://localhost:3000/api/participant/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': testClientIp
      },
      body: JSON.stringify({ bib: '7711', dob: testDob })
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);
    sessionToken = loginRes.cookies.get(PARTICIPANT_COOKIE_NAME)!.value;
  });

  afterAll(async () => {
    // Strictly delete only documents created by this test
    const batch = db.batch();
    for (const ref of createdDocRefs) {
      batch.delete(ref);
    }
    await batch.commit().catch(() => {});

    // Verify existing participant records remain intact
    const postCleanup = await db.collection('participants').get();
    expect(postCleanup.size).toBe(initialParticipantCount);
  });

  it('1. verifies Digital ID neutral photo placeholder, PNG download and print output', async () => {
    const meReq = new NextRequest('http://localhost:3000/api/participant/me', {
      method: 'GET',
      headers: { cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}` }
    });
    const meRes = await meRoute(meReq);
    const data = await meRes.json();

    expect(data.profile.photoUrl).toBe('');

    // Neutral photo placeholder check
    const photoHtml = renderToStaticMarkup(
      React.createElement(ParticipantPhoto, {
        photoUrl: data.profile.photoUrl,
        name: data.profile.name,
        shape: 'circle',
        size: 'lg'
      })
    );
    expect(photoHtml).toContain('data-testid="participant-photo-fallback"');
    expect(photoHtml).toContain('data-testid="participant-silhouette"');
    expect(photoHtml).toContain('data-testid="participant-initials"');
    expect(photoHtml).toContain('NM');
    expect(photoHtml).not.toContain('unsplash.com');

    // Digital ID Card rendering check
    const cardHtml = renderToStaticMarkup(
      React.createElement(DigitalIdCard, {
        participant: {
          ...data.profile,
          email: '',
          phone: '',
          dob: '',
          remarks: '',
          registeredEventIds: [testSoloRegId, testGroupRegId]
        },
        isOpen: true,
        onClose: () => {}
      })
    );
    expect(cardHtml).toContain('Download PNG');
    expect(cardHtml).toContain('Print ID Badge');
    expect(cardHtml).toContain('SAHITHYOLSAV 2025');
    expect(cardHtml).not.toContain('unsplash.com');

    // Cryptographic QR badge check
    const qrReq = new NextRequest('http://localhost:3000/api/participant/qr', {
      method: 'GET',
      headers: { cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}` }
    });
    const qrRes = await qrRoute(qrReq);
    const qrData = await qrRes.json();
    expect(qrRes.status).toBe(200);
    expect(QrSignerService.verifyParticipantQrToken(testPartId, testBib, qrData.token)).toBe(true);
  });

  it('2. verifies SOLO published competition points contribute to the participant individual total', async () => {
    const meReq = new NextRequest('http://localhost:3000/api/participant/me', {
      method: 'GET',
      headers: { cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}` }
    });
    const data = await (await meRoute(meReq)).json();
    const soloEvent = data.events.find((e: any) => e.registrationId === testSoloRegId);

    expect(soloEvent).toBeDefined();
    expect(soloEvent.type).toBe('SOLO');
    expect(soloEvent.published).toBe(true);
    expect(soloEvent.individualPoints).toBe(10);
    expect(soloEvent.groupTeamPoints).toBe(0);
  });

  it('3. verifies GROUP competition points contribute to the team only', async () => {
    const meReq = new NextRequest('http://localhost:3000/api/participant/me', {
      method: 'GET',
      headers: { cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}` }
    });
    const data = await (await meRoute(meReq)).json();
    const groupEvent = data.events.find((e: any) => e.registrationId === testGroupRegId);

    expect(groupEvent).toBeDefined();
    expect(groupEvent.type).toBe('GROUP');
    expect(groupEvent.published).toBe(true);
    expect(groupEvent.groupTeamPoints).toBe(15);
    expect(groupEvent.individualPoints).toBe(0); // Team only - zero individual points

    // Total individual points reflect only SOLO points (10), NOT 25
    expect(data.summary.individualPoints).toBe(10);
  });

  it('4. verifies unpublished results do not contribute to the visible points total', async () => {
    // Unpublish solo result
    await db.collection('results').doc(testSoloResultDocId).update({ resultStatus: 'UNPUBLISHED' });

    const meReq = new NextRequest('http://localhost:3000/api/participant/me', {
      method: 'GET',
      headers: { cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}` }
    });
    const data = await (await meRoute(meReq)).json();
    const soloEvent = data.events.find((e: any) => e.registrationId === testSoloRegId);

    expect(soloEvent.published).toBe(false);
    expect(soloEvent.score).toBeNull();
    expect(soloEvent.position).toBeNull();
    expect(soloEvent.individualPoints).toBe(0);

    // Total points drops to 0 while unpublished
    expect(data.summary.individualPoints).toBe(0);
  });

  it('5. verifies republishing correctly restores eligible points without duplication', async () => {
    // Republish solo result
    await db.collection('results').doc(testSoloResultDocId).update({ resultStatus: 'PUBLISHED' });

    const meReq = new NextRequest('http://localhost:3000/api/participant/me', {
      method: 'GET',
      headers: { cookie: `${PARTICIPANT_COOKIE_NAME}=${sessionToken}` }
    });
    const data = await (await meRoute(meReq)).json();
    const soloEvent = data.events.find((e: any) => e.registrationId === testSoloRegId);

    expect(soloEvent.published).toBe(true);
    expect(soloEvent.score).toBe(95);
    expect(soloEvent.position).toBe(1);
    expect(soloEvent.individualPoints).toBe(10);

    // Total individual points accurately restored to 10 (not duplicated to 20)
    expect(data.summary.individualPoints).toBe(10);
  });

  it('6. verifies participant records and existing staging data remain intact', async () => {
    const current = await db.collection('participants').get();
    // Only the single test participant was added; all initial participants remain present
    expect(current.size).toBe(initialParticipantCount + 1);
  });
});
