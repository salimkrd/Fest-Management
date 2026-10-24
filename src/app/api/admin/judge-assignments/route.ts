import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { JudgeService } from '@/services/judgeService';
import { getAdminDb } from '@/lib/firebase/admin';
import { getTrustedAppUrl } from '@/lib/trustedUrl';
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

    const body = await req.json();
    const { competitionId, judgeName, judgePhone } = body;
    if (
      typeof competitionId !== 'string' ||
      typeof judgeName !== 'string' ||
      typeof judgePhone !== 'string' ||
      !competitionId.trim() ||
      !judgeName.trim() ||
      !judgePhone.trim()
    ) {
      return NextResponse.json(
        { error: 'Validation Error: Competition, judge name, and phone are required.' },
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

    const competitionSnapshot = await db.collection('competitions').doc(competitionId).get();
    if (!competitionSnapshot.exists) {
      return NextResponse.json(
        { error: 'Validation Error: The selected competition does not exist.' },
        { status: 400 }
      );
    }

    const competition = competitionSnapshot.data()!;
    const credentials = await JudgeService.issueAssignment({
      judgeName: judgeName.trim(),
      judgePhone: judgePhone.trim(),
      competitionId,
      competitionCode: competition.code || '',
      competitionName: competition.name || '',
      categoryName: competition.categoryName || 'General',
      type: competition.type || 'SOLO',
      stageName: competition.stageName || 'Main Stage',
      baseUrl: getTrustedAppUrl(req),
      adminIdToken
    });
    await competitionSnapshot.ref.update({
      assignedJudges: FieldValue.arrayUnion(judgeName.trim())
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: credentials.assignment.id,
        judgeName: credentials.assignment.judgeName,
        judgePhone: credentials.assignment.judgePhone,
        competitionId: credentials.assignment.competitionId,
        competitionCode: credentials.assignment.competitionCode,
        competitionName: credentials.assignment.competitionName,
        stageName: credentials.assignment.stageName,
        accessCode: credentials.assignment.accessCode,
        issuedAt: credentials.assignment.issuedAt,
        expiresAt: credentials.assignment.expiresAt,
        revoked: false,
        status: 'ACTIVE',
        categoryName: credentials.assignment.categoryName,
        type: credentials.assignment.type
      },
      oneTimeSecret: credentials.oneTimeSecret,
      directUrl: credentials.directLoginUrl
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
