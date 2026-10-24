import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';
import { handleApiError } from '@/lib/apiErrorHelper';
import { PointsLedgerService } from '@/services/pointsLedgerService';

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

    // 1. Verify parent competition document exists before doing any deletion
    const compRef = db.collection('competitions').doc(id);
    const compDoc = await compRef.get();
    if (!compDoc.exists) {
      return NextResponse.json(
        { error: `Competition with ID "${id}" was not found.` },
        { status: 404 }
      );
    }

    // 2. Fetch all dependent child collections
    const [
      judgeAssignSnap,
      markEntriesSnap,
      registrationsSnap,
      schedulesSnap,
      resultsSnap,
      resultDocDirect,
      pointsSnap
    ] = await Promise.all([
      db.collection('judgeAssignments').where('competitionId', '==', id).get(),
      db.collection('markEntries').where('competitionId', '==', id).get(),
      db.collection('registrations').where('competitionId', '==', id).get(),
      db.collection('schedules').where('competitionId', '==', id).get(),
      db.collection('results').where('competitionId', '==', id).get(),
      db.collection('results').doc(`res-${id}`).get(),
      db.collection('pointsLedger').where('competitionId', '==', id).get()
    ]);

    // 3. Assemble and deduplicate all child document references
    const rawChildDocs: FirebaseFirestore.DocumentReference[] = [
      ...judgeAssignSnap.docs.map(doc => doc.ref),
      ...markEntriesSnap.docs.map(doc => doc.ref),
      ...registrationsSnap.docs.map(doc => doc.ref),
      ...schedulesSnap.docs.map(doc => doc.ref),
      ...resultsSnap.docs.map(doc => doc.ref),
      ...(resultDocDirect.exists ? [resultDocDirect.ref] : []),
      ...pointsSnap.docs.map(doc => doc.ref)
    ];

    const seenDocPaths = new Set<string>();
    const childDocsToDelete: FirebaseFirestore.DocumentReference[] = [];
    for (const ref of rawChildDocs) {
      if (!seenDocPaths.has(ref.path)) {
        seenDocPaths.add(ref.path);
        childDocsToDelete.push(ref);
      }
    }

    // 4. Safely delete all child records in batches of 400 (handles large collections without exceeding 500 ops limit)
    const BATCH_SIZE = 400;
    for (let i = 0; i < childDocsToDelete.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = childDocsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // 5. If committed points were deleted, recalculate championship leaderboard and team totals
    const hadCommittedPoints = pointsSnap.docs.some(doc => doc.data()?.status === 'COMMITTED');
    if (hadCommittedPoints) {
      await PointsLedgerService.syncLeaderboardFromLedger();
    }

    // 6. ONLY AFTER all child records and points are safely handled, delete the parent competition document
    await compRef.delete();

    return NextResponse.json({
      success: true,
      deletedCompetitionId: id,
      recalculatedLeaderboard: hadCommittedPoints,
      cascadeDeleted: {
        judgeAssignments: judgeAssignSnap.size,
        markEntries: markEntriesSnap.size,
        registrations: registrationsSnap.size,
        schedules: schedulesSnap.size,
        results: resultsSnap.size + (resultDocDirect.exists ? 1 : 0),
        pointsLedger: pointsSnap.size
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
