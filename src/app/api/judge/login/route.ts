import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { verifyJudgeAssignment, JudgeAssignmentRecord } from '@/domain/judgeAuth';
import { buildGreenRoomRosterSnapshot } from '@/domain/greenRoomRoster';

/**
 * Server API Endpoint for Secure Jury Authentication (/api/judge/login)
 * 
 * Verifies juror access codes against Firestore judgeAssignments using Firebase Admin SDK.
 * This bypasses restrictive client-side Firestore security rules while ensuring
 * sensitive hashes and salts are NEVER leaked to the client.
 */
export async function POST(req: NextRequest) {
  try {
    await syncWorkloadIdentityToken();
    const body = await req.json();
    const { accessCode, competitionId, secret } = body;

    const cleanCode = (accessCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return NextResponse.json(
        { error: 'Please provide your assigned Juror Access Code (e.g. JRY-4101).' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database service unavailable. Please check system configuration.' },
        { status: 503 }
      );
    }

    // 1. Find matching assignment by accessCode or id
    let assignment: JudgeAssignmentRecord | null = null;
    let assignmentDocId = '';

    const snap = await db.collection('judgeAssignments')
      .where('accessCode', '==', cleanCode)
      .limit(1)
      .get();

    if (!snap.empty) {
      assignmentDocId = snap.docs[0].id;
      assignment = snap.docs[0].data() as JudgeAssignmentRecord;
    } else {
      // Direct doc ID lookup or fallback scan
      const directDoc = await db.collection('judgeAssignments').doc(cleanCode.toLowerCase()).get();
      if (directDoc.exists) {
        assignmentDocId = directDoc.id;
        assignment = directDoc.data() as JudgeAssignmentRecord;
      } else {
        const directDocRaw = await db.collection('judgeAssignments').doc(cleanCode).get();
        if (directDocRaw.exists) {
          assignmentDocId = directDocRaw.id;
          assignment = directDocRaw.data() as JudgeAssignmentRecord;
        } else {
          // Scan in case of case variance or leading/trailing whitespace
          const allSnap = await db.collection('judgeAssignments').get();
          const matchDoc = allSnap.docs.find(d => {
            const data = d.data();
            const storedCode = (data.accessCode || '').toString().trim().toUpperCase();
            return storedCode === cleanCode || d.id.toUpperCase() === cleanCode;
          });
          if (matchDoc) {
            assignmentDocId = matchDoc.id;
            assignment = matchDoc.data() as JudgeAssignmentRecord;
          }
        }
      }
    }

    if (!assignment) {
      return NextResponse.json(
        { error: 'Invalid Access Code. Please check the WhatsApp invitation or contact fest conveners.' },
        { status: 404 }
      );
    }

    // Ensure ID is attached
    if (!assignment.id) {
      assignment.id = assignmentDocId;
    }

    // 2. Revocation check
    if (assignment.revoked || assignment.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'This jury assignment has been revoked by the administrator.' },
        { status: 403 }
      );
    }

    // 3. Expiration check
    if (assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'This jury access code has expired. Please request a new link from the admin desk.' },
        { status: 403 }
      );
    }

    // 4. Competition mismatch check
    if (competitionId && assignment.competitionId && assignment.competitionId !== competitionId) {
      return NextResponse.json(
        { error: 'Access denied: This juror assignment is valid for a different stage competition.' },
        { status: 403 }
      );
    }

    // 5. PIN / Secret check (Mandatory verification to prevent exposure of contestant data)
    const cleanSecret = (secret || '').trim();
    if (assignment.secretHash || ('pin' in assignment)) {
      if (!cleanSecret) {
        return NextResponse.json(
          { error: 'Juror PIN or Secret is required for authentication.' },
          { status: 401 }
        );
      }
      const authResult = await verifyJudgeAssignment(assignment, cleanSecret);
      if (!authResult.valid) {
        return NextResponse.json(
          { error: `Invalid Juror Secret / PIN (${authResult.reason || 'Verification Failed'}).` },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This juror assignment has no security credentials configured. Please contact the administrator.' },
        { status: 403 }
      );
    }

    // 6. Fetch competition metadata and actual Green Room assignments
    let competitionData: Record<string, unknown> | null = null;
    let registrations: Array<{
      id: string;
      codeLetter: string;
      codeIndex: number;
      status: string;
    }> = [];
    let rosterVersion = '';

    const effectiveCompId = assignment.competitionId || competitionId;
    if (effectiveCompId) {
      try {
        const compDoc = await db.collection('competitions').doc(effectiveCompId).get();
        if (compDoc.exists) {
          competitionData = { id: compDoc.id, ...compDoc.data() };
        }
      } catch (e) {
        console.warn('[JudgeLogin] Could not fetch competition:', e);
      }

      try {
        const [grSnap, registrationsSnapshot] = await Promise.all([
          db.collection('greenRoomAssignments')
            .where('competitionId', '==', effectiveCompId)
            .get(),
          db.collection('registrations')
            .where('competitionId', '==', effectiveCompId)
            .get()
        ]);

        const roster = buildGreenRoomRosterSnapshot(
          effectiveCompId,
          grSnap.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
        );
        const approvedRegistrationIds = new Set(
          registrationsSnapshot.docs
            .filter(doc => String(doc.data().status || '').trim().toUpperCase() === 'APPROVED')
            .map(doc => doc.id)
        );
        for (const entry of roster.entries) {
          if (!approvedRegistrationIds.has(entry.registrationId)) {
            throw new Error(
              `Roster Integrity Error: Code Letter "${entry.codeLetter}" does not point to an approved registration.`
            );
          }
        }

        rosterVersion = roster.version;
        registrations = roster.entries.map(item => ({
          id: item.codeLetter,
          codeLetter: item.codeLetter,
          codeIndex: item.codeIndex,
          status: item.status
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown roster error';
        console.error('[JudgeLogin] Anonymous roster integrity check failed:', message);
        return NextResponse.json(
          {
            error: 'The Green Room Code Letter roster could not be verified. Judge access to mark entry is blocked; contact the administrator.',
            code: 'ROSTER_INTEGRITY_ERROR'
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // 7. Sanitize assignment (omit salt and secretHash)
    const sanitizedAssignment = {
      id: assignment.id,
      judgeName: assignment.judgeName || 'Juror',
      judgePhone: assignment.judgePhone || '',
      competitionId: assignment.competitionId || effectiveCompId,
      competitionCode: assignment.competitionCode || (competitionData ? (competitionData.code as string) : 'CMP-X'),
      competitionName: assignment.competitionName || (competitionData ? (competitionData.name as string) : 'Stage Competition'),
      categoryName: (assignment as { categoryName?: string }).categoryName || (competitionData ? (competitionData.categoryName as string) : 'General'),
      type: (assignment as { type?: string }).type || (competitionData ? (competitionData.type as string) : 'SOLO'),
      stageName: assignment.stageName || (competitionData ? (competitionData.stageName as string) : 'Main Stage'),
      accessCode: assignment.accessCode,
      issuedAt: assignment.issuedAt || '',
      expiresAt: assignment.expiresAt || '',
      status: assignment.status || 'ACTIVE'
    };

    return NextResponse.json({
      success: true,
      assignment: sanitizedAssignment,
      competition: competitionData,
      contestants: registrations,
      registrations,
      rosterVersion
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });

  } catch (error: unknown) {
    console.error('[JudgeLogin] Error during authentication:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error during juror verification.' },
      { status: 500 }
    );
  }
}
