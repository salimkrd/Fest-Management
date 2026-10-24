import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';
import { handleApiError } from '@/lib/apiErrorHelper';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = req.headers.get('authorization') || '';
    const adminIdToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!adminIdToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing administrator authentication token.' },
        { status: 401 }
      );
    }

    await AuthService.assertAdmin(adminIdToken);

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Validation Error: Invalid competition ID.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database service unavailable.' },
        { status: 503 }
      );
    }

    // 1. Delete competition document
    const compRef = db.collection('competitions').doc(id);
    const compDoc = await compRef.get();
    if (compDoc.exists) {
      await compRef.delete();
    }

    // 2. Cascade delete all judgeAssignments for this competition
    const judgeAssignSnap = await db.collection('judgeAssignments').where('competitionId', '==', id).get();
    const batch = db.batch();
    judgeAssignSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 3. Cascade delete all markEntries for this competition
    const markEntriesSnap = await db.collection('markEntries').where('competitionId', '==', id).get();
    markEntriesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 4. Cascade delete all registrations for this competition
    const registrationsSnap = await db.collection('registrations').where('competitionId', '==', id).get();
    registrationsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 5. Cascade delete all schedules for this competition
    const schedulesSnap = await db.collection('schedules').where('competitionId', '==', id).get();
    schedulesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 6. Cascade delete results and pointsLedger for this competition
    const resultsSnap = await db.collection('results').where('competitionId', '==', id).get();
    resultsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    const resultDocDirect = db.collection('results').doc(`res-${id}`);
    const directResultSnap = await resultDocDirect.get();
    if (directResultSnap.exists) {
      batch.delete(resultDocDirect);
    }

    const pointsSnap = await db.collection('pointsLedger').where('competitionId', '==', id).get();
    pointsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      deletedCompetitionId: id,
      cascadeDeleted: {
        judgeAssignments: judgeAssignSnap.size,
        markEntries: markEntriesSnap.size,
        registrations: registrationsSnap.size,
        schedules: schedulesSnap.size,
        results: resultsSnap.size + (directResultSnap.exists ? 1 : 0),
        pointsLedger: pointsSnap.size
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
