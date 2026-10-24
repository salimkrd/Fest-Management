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

export async function GET(req: NextRequest) {
  try {
    const adminIdToken = extractToken(req);
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

    const snap = await db.collection('categories').get();
    const categories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, categories }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
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

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!name) {
      return NextResponse.json(
        { error: 'Validation Error: Category title is required.' },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Validation Error: Category code is required.' },
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

    // Check code uniqueness across existing categories
    const existingCodeSnap = await db.collection('categories').where('code', '==', code).get();
    if (!existingCodeSnap.empty) {
      return NextResponse.json(
        { error: `Validation Error: A category with code "${code}" already exists.` },
        { status: 400 }
      );
    }

    const id = typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : 'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

    const now = new Date().toISOString();
    const categoryDoc = {
      id,
      name,
      code,
      ageRange: typeof body.ageRange === 'string' ? body.ageRange.trim() : '',
      classRange: typeof body.classRange === 'string' ? body.classRange.trim() : '',
      eligibility: typeof body.eligibility === 'string' ? body.eligibility.trim() : '',
      status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      enrolledCount: typeof body.enrolledCount === 'number' ? body.enrolledCount : 0,
      competitionsCount: typeof body.competitionsCount === 'number' ? body.competitionsCount : 0,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('categories').doc(id).set(categoryDoc);

    return NextResponse.json({
      success: true,
      category: categoryDoc
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
