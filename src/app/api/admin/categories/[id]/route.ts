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
        { error: 'Validation Error: Invalid category ID.' },
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

    const catRef = db.collection('categories').doc(id);
    const catDoc = await catRef.get();
    if (!catDoc.exists) {
      return NextResponse.json(
        { error: `Category with ID "${id}" was not found.` },
        { status: 404 }
      );
    }

    // Dependency check 1: Check if any competitions are assigned to this category
    const linkedCompsSnap = await db.collection('competitions').where('categoryId', '==', id).get();
    if (!linkedCompsSnap.empty) {
      return NextResponse.json(
        {
          error: `Cannot delete category: ${linkedCompsSnap.size} active competition(s) are assigned to this division tier. Please reassign or delete the competitions first.`,
          dependentCompetitionsCount: linkedCompsSnap.size,
          dependentCompetitions: linkedCompsSnap.docs.map(d => ({
            id: d.id,
            code: d.data().code,
            name: d.data().name
          }))
        },
        { status: 400 }
      );
    }

    // Dependency check 2: Check if any participants are enrolled in this category
    const linkedPartsSnap = await db.collection('participants').where('categoryId', '==', id).get();
    if (!linkedPartsSnap.empty) {
      return NextResponse.json(
        {
          error: `Cannot delete category: ${linkedPartsSnap.size} participant(s) are enrolled in this division tier. Please reassign or remove the participants first.`,
          dependentParticipantsCount: linkedPartsSnap.size
        },
        { status: 400 }
      );
    }

    // Only delete after dependency checks pass
    await catRef.delete();

    return NextResponse.json({
      success: true,
      deletedCategoryId: id
    });
  } catch (error) {
    return handleApiError(error);
  }
}
