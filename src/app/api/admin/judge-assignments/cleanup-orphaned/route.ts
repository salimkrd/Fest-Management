import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';
import { handleApiError } from '@/lib/apiErrorHelper';

export async function POST(req: NextRequest) {
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

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database service unavailable.' },
        { status: 503 }
      );
    }

    // Parse options from body and query parameters
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const isDryRun = body.dryRun === true || url.searchParams.get('dryRun') === 'true';
    const isConfirmed = body.confirm === true || url.searchParams.get('confirm') === 'true';

    // 1. Fetch all existing competition IDs from Firestore
    const competitionsSnap = await db.collection('competitions').get();
    const existingCompetitionIds = new Set(competitionsSnap.docs.map(d => d.id));

    // 2. Query all judge assignments and detect orphaned entries
    const judgeAssignSnap = await db.collection('judgeAssignments').get();
    const orphanedJudgeAssignments: FirebaseFirestore.DocumentReference[] = [];
    const orphanedJudgeDetails: Array<{ id: string; competitionId: string; judgeName: string }> = [];

    judgeAssignSnap.docs.forEach(doc => {
      const data = doc.data();
      const compId = data.competitionId;
      if (!compId || !existingCompetitionIds.has(compId)) {
        orphanedJudgeAssignments.push(doc.ref);
        orphanedJudgeDetails.push({
          id: doc.id,
          competitionId: compId || 'UNKNOWN',
          judgeName: data.judgeName || 'Unassigned'
        });
      }
    });

    // 3. Query all mark entries and detect orphaned entries
    const markEntriesSnap = await db.collection('markEntries').get();
    const orphanedMarkEntries: FirebaseFirestore.DocumentReference[] = [];
    const orphanedMarkDetails: Array<{ id: string; competitionId: string }> = [];

    markEntriesSnap.docs.forEach(doc => {
      const data = doc.data();
      const compId = data.competitionId || data.metadata?.competitionId;
      if (!compId || !existingCompetitionIds.has(compId)) {
        orphanedMarkEntries.push(doc.ref);
        orphanedMarkDetails.push({
          id: doc.id,
          competitionId: compId || 'UNKNOWN'
        });
      }
    });

    const totalOrphaned = orphanedJudgeAssignments.length + orphanedMarkEntries.length;

    // 4. Dry-run mode: Return preview without modifying any records
    if (isDryRun || !isConfirmed) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        requiresConfirmation: true,
        existingCompetitionsCount: existingCompetitionIds.size,
        orphanedJudgeAssignmentsCount: orphanedJudgeAssignments.length,
        orphanedMarkEntriesCount: orphanedMarkEntries.length,
        totalOrphaned,
        orphanedJudgeDetails,
        orphanedMarkDetails,
        message: totalOrphaned > 0
          ? `Dry-run preview: ${totalOrphaned} orphaned records detected (${orphanedJudgeAssignments.length} judge assignments, ${orphanedMarkEntries.length} mark entries). Provide confirm=true to execute permanent cleanup.`
          : 'Dry-run preview: No orphaned judge assignments or mark entries detected. Database is clean.'
      });
    }

    // 5. Confirmed cleanup execution: Batch delete chunked by 400
    const allOrphaned = [...orphanedJudgeAssignments, ...orphanedMarkEntries];
    if (allOrphaned.length > 0) {
      const BATCH_SIZE = 400;
      for (let i = 0; i < allOrphaned.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = allOrphaned.slice(i, i + BATCH_SIZE);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      confirmed: true,
      existingCompetitionsCount: existingCompetitionIds.size,
      removedJudgeAssignments: orphanedJudgeAssignments.length,
      removedMarkEntries: orphanedMarkEntries.length,
      message: `Permanently cleaned up ${orphanedJudgeAssignments.length} orphaned judge assignments and ${orphanedMarkEntries.length} orphaned mark entries.`
    });
  } catch (error) {
    return handleApiError(error);
  }
}
