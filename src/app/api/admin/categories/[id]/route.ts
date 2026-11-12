import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { AuthService } from '@/services/authService';
import { handleApiError } from '@/lib/apiErrorHelper';
import { resolveCategoryEligibilityPolicy, isParticipantEligibleForCategory } from '@/domain/eligibility';
import { Category, Competition, Participant } from '@/types/fest';

class CategoryConflictError extends Error {
  conflicts: string[];
  constructor(message: string, conflicts: string[]) {
    super(message);
    this.name = 'CategoryConflictError';
    this.conflicts = conflicts;
  }
}

function extractToken(req: NextRequest, body?: unknown): string {
  const authorization = req.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  if (body && typeof body === 'object' && 'adminIdToken' in body) {
    const adminIdToken = (body as { adminIdToken?: unknown }).adminIdToken;
    if (typeof adminIdToken === 'string') {
      return adminIdToken.trim();
    }
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
    let body: Record<string, unknown> = {};
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

    const updatedCategory = await db.runTransaction(async (transaction) => {
      const catDoc = await transaction.get(catRef);
      if (!catDoc.exists) {
        throw new Error(`Category with ID "${id}" was not found.`);
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString()
      };

      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          throw new Error('Validation Error: Category title cannot be empty.');
        }
        updateData.name = body.name.trim();
      }

      if (body.code !== undefined) {
        if (typeof body.code !== 'string' || !body.code.trim()) {
          throw new Error('Validation Error: Category code cannot be empty.');
        }
        const newCode = body.code.trim().toUpperCase();
        const existingData = catDoc.data();
        if (newCode !== existingData?.code) {
          const conflictSnap = await transaction.get(db.collection('categories').where('code', '==', newCode));
          const conflictingDocs = conflictSnap.docs.filter(d => d.id !== id);
          if (conflictingDocs.length > 0) {
            throw new Error(`Validation Error: Category code "${newCode}" is already taken.`);
          }
        }
        updateData.code = newCode;
      }

      if (body.ageRange !== undefined) updateData.ageRange = String(body.ageRange).trim();
      if (body.classRange !== undefined) updateData.classRange = String(body.classRange).trim();
      if (body.eligibility !== undefined) updateData.eligibility = String(body.eligibility).trim();
      if (body.status !== undefined) {
        if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
          throw new Error('Validation Error: Status must be ACTIVE or INACTIVE.');
        }
        updateData.status = body.status;
      }
      if (typeof body.enrolledCount === 'number') updateData.enrolledCount = body.enrolledCount;
      if (typeof body.competitionsCount === 'number') updateData.competitionsCount = body.competitionsCount;

      if (body.participantEligibility !== undefined) {
        if (body.participantEligibility !== 'CATEGORY_ONLY' && body.participantEligibility !== 'OPEN_TO_ALL') {
          throw new Error('Validation Error: Participant eligibility must be CATEGORY_ONLY or OPEN_TO_ALL.');
        }

        const newPolicy = body.participantEligibility as 'CATEGORY_ONLY' | 'OPEN_TO_ALL';
        const existingCategory = { id: catDoc.id, ...catDoc.data() } as Category;
        const currentPolicy = resolveCategoryEligibilityPolicy(existingCategory);

        // If switching from OPEN_TO_ALL to CATEGORY_ONLY, inspect all active registrations
        if (currentPolicy === 'OPEN_TO_ALL' && newPolicy === 'CATEGORY_ONLY') {
          const compsSnap = await transaction.get(db.collection('competitions').where('categoryId', '==', id));
          if (!compsSnap.empty) {
            const comps = compsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Competition));
            const compMap = new Map(comps.map(c => [c.id, c]));
            const compIds = comps.map(c => c.id);

            // Fetch all registrations for these competitions inside the transaction
            const regSnaps = await Promise.all(
              compIds.map(cId => transaction.get(db.collection('registrations').where('competitionId', '==', cId)))
            );
            const activeRegDocs = regSnaps
              .flatMap(s => s.docs)
              .filter(d => {
                const st = String(d.data().status || '');
                return st !== 'REJECTED' && st !== 'CANCELLED';
              });

            if (activeRegDocs.length > 0) {
              // Collect all participants involved in active registrations
              const partIds = Array.from(new Set(activeRegDocs.flatMap(d => {
                const data = d.data();
                return [
                  data.participantId,
                  data.groupLeaderId,
                  ...(Array.isArray(data.groupMembers) ? data.groupMembers : [])
                ].filter(Boolean);
              })));

              const partSnaps = await Promise.all(
                partIds.map(pId => transaction.get(db.collection('participants').doc(pId)))
              );
              const partMap = new Map(partSnaps.map(s => [s.id, { id: s.id, ...s.data() } as Participant]));

              // Simulate the category with restricted CATEGORY_ONLY policy
              const simulatedCategory: Category = {
                ...existingCategory,
                participantEligibility: 'CATEGORY_ONLY'
              };

              const conflicts: string[] = [];
              for (const regDoc of activeRegDocs) {
                const regData = regDoc.data();
                const comp = compMap.get(regData.competitionId);
                if (!comp) continue;

                const regPartIds = regData.type === 'GROUP'
                  ? Array.from(new Set([regData.groupLeaderId, ...(Array.isArray(regData.groupMembers) ? regData.groupMembers : [])].filter(Boolean)))
                  : [regData.participantId].filter(Boolean);

                for (const pId of regPartIds) {
                  const part = partMap.get(pId);
                  if (!part) continue;
                  const isEligible = isParticipantEligibleForCategory(part, simulatedCategory);
                  if (!isEligible) {
                    conflicts.push(
                      `${comp.code || 'CMP'} (${comp.name}) - ${part.name} [Participant Category: ${part.categoryName || 'Different'}]`
                    );
                  }
                }
              }

              if (conflicts.length > 0) {
                throw new CategoryConflictError(
                  `Validation Error: Cannot change eligibility policy to Restricted. Incompatible active registrations exist in: ${conflicts.join('; ')}. Please resolve conflicting registrations first.`,
                  conflicts
                );
              }
            }
          }
        }

        updateData.participantEligibility = newPolicy;
      }

      transaction.update(catRef, updateData);

      return { id, ...catDoc.data(), ...updateData };
    });

    return NextResponse.json({
      success: true,
      category: updatedCategory
    }, { status: 200 });
  } catch (error) {
    if (error instanceof CategoryConflictError) {
      return NextResponse.json({
        error: error.message,
        conflicts: error.conflicts
      }, { status: 400 });
    }
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
