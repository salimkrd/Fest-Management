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

    // 1. Fetch all existing competition IDs from Firestore
    const competitionsSnap = await db.collection('competitions').get();
    const existingCompetitionIds = new Set(competitionsSnap.docs.map(d => d.id));

    // 2. Query all judge assignments and detect orphaned entries
    const judgeAssignSnap = await db.collection('judgeAssignments').get();
    const orphanedJudgeAssignments: FirebaseFirestore.DocumentReference[] = [];

    judgeAssignSnap.docs.forEach(doc => {
      const data = doc.data();
      const compId = data.competitionId;
      if (!compId || !existingCompetitionIds.has(compId)) {
        orphanedJudgeAssignments.push(doc.ref);
      }
    });

    // 3. Query all mark entries and detect orphaned entries
    const markEntriesSnap = await db.collection('markEntries').get();
    const orphanedMarkEntries: FirebaseFirestore.DocumentReference[] = [];

    markEntriesSnap.docs.forEach(doc => {
      const data = doc.data();
      const compId = data.competitionId;
      if (!compId || !existingCompetitionIds.has(compId)) {
        orphanedMarkEntries.push(doc.ref);
      }
    });

    // 4. Batch delete all orphaned documents
    const allOrphaned = [...orphanedJudgeAssignments, ...orphanedMarkEntries];
    if (allOrphaned.length > 0) {
      // Chunk batches by 450 to avoid Firestore 500 ops limit
      for (let i = 0; i < allOrphaned.length; i += 450) {
        const batch = db.batch();
        const chunk = allOrphaned.slice(i, i + 450);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      existingCompetitionsCount: existingCompetitionIds.size,
      removedJudgeAssignments: orphanedJudgeAssignments.length,
      removedMarkEntries: orphanedMarkEntries.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}
