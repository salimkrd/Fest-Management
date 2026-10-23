import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyJudgeAssignment, JudgeAssignmentRecord } from '@/domain/judgeAuth';

/**
 * Server API Endpoint for Secure Jury Authentication (/api/judge/login)
 * 
 * Verifies juror access codes against Firestore judgeAssignments using Firebase Admin SDK.
 * This bypasses restrictive client-side Firestore security rules while ensuring
 * sensitive hashes and salts are NEVER leaked to the client.
 */
export async function POST(req: NextRequest) {
  try {
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

    // 5. PIN / Secret check (if secret is provided)
    if (secret && typeof secret === 'string' && secret.trim().length > 0) {
      const authResult = await verifyJudgeAssignment(assignment, secret.trim());
      if (!authResult.valid) {
        return NextResponse.json(
          { error: `Invalid Juror Secret / PIN (${authResult.reason || 'Verification Failed'}).` },
          { status: 401 }
        );
      }
    }

    // 6. Fetch competition metadata and approved registrations for offline/cross-browser support
    let competitionData: any = null;
    let registrations: any[] = [];

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
        const regsSnap = await db.collection('registrations')
          .where('competitionId', '==', effectiveCompId)
          .get();
        registrations = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn('[JudgeLogin] Could not fetch registrations:', e);
      }
    }

    // 7. Sanitize assignment (omit salt and secretHash)
    const sanitizedAssignment = {
      id: assignment.id,
      judgeName: assignment.judgeName || 'Juror',
      judgePhone: assignment.judgePhone || '',
      competitionId: assignment.competitionId || effectiveCompId,
      competitionCode: assignment.competitionCode || (competitionData ? competitionData.code : 'CMP-X'),
      competitionName: assignment.competitionName || (competitionData ? competitionData.name : 'Stage Competition'),
      categoryName: (assignment as any).categoryName || (competitionData ? competitionData.categoryName : 'General'),
      type: (assignment as any).type || (competitionData ? competitionData.type : 'SOLO'),
      stageName: assignment.stageName || (competitionData ? competitionData.stageName : 'Main Stage'),
      accessCode: assignment.accessCode,
      issuedAt: assignment.issuedAt || '',
      expiresAt: assignment.expiresAt || '',
      status: assignment.status || 'ACTIVE'
    };

    return NextResponse.json({
      success: true,
      assignment: sanitizedAssignment,
      competition: competitionData,
      registrations
    }, { status: 200 });

  } catch (error: any) {
    console.error('[JudgeLogin] Error during authentication:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error during juror verification.' },
      { status: 500 }
    );
  }
}
