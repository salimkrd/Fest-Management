import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';
import { handleApiError } from '@/lib/apiErrorHelper';

function extractToken(req: NextRequest, body?: any): string {
  const authorization = req.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  if (body?.adminIdToken && typeof body.adminIdToken === 'string') {
    return body.adminIdToken.trim();
  }
  return '';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminIdToken = extractToken(req);
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

    return NextResponse.json({
      success: true,
      category: { id: catDoc.id, ...catDoc.data() }
    }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Validation Error: Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const adminIdToken = extractToken(req, body);
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

    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { error: 'Validation Error: Category title cannot be empty.' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.code !== undefined) {
      if (typeof body.code !== 'string' || !body.code.trim()) {
        return NextResponse.json(
          { error: 'Validation Error: Category code cannot be empty.' },
          { status: 400 }
        );
      }
      const newCode = body.code.trim().toUpperCase();
      const existingData = catDoc.data();
      if (newCode !== existingData?.code) {
        const conflictSnap = await db.collection('categories').where('code', '==', newCode).get();
        const conflictingDocs = conflictSnap.docs.filter(d => d.id !== id);
        if (conflictingDocs.length > 0) {
          return NextResponse.json(
            { error: `Validation Error: Category code "${newCode}" is already taken.` },
            { status: 400 }
          );
        }
      }
      updateData.code = newCode;
    }

    if (body.ageRange !== undefined) updateData.ageRange = String(body.ageRange).trim();
    if (body.classRange !== undefined) updateData.classRange = String(body.classRange).trim();
    if (body.eligibility !== undefined) updateData.eligibility = String(body.eligibility).trim();
    if (body.status !== undefined) {
      if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
        return NextResponse.json(
          { error: 'Validation Error: Status must be ACTIVE or INACTIVE.' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }
    if (typeof body.enrolledCount === 'number') updateData.enrolledCount = body.enrolledCount;
    if (typeof body.competitionsCount === 'number') updateData.competitionsCount = body.competitionsCount;

    await catRef.update(updateData);

    const updatedSnap = await catRef.get();
    return NextResponse.json({
      success: true,
      category: { id: updatedSnap.id, ...updatedSnap.data() }
    }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(req, context);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminIdToken = extractToken(req);

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
