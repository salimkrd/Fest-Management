import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { QrSignerService } from '@/services/qrSignerService';
import { getAdminDb } from '@/lib/firebase/admin';
import { handleApiError } from '@/lib/apiErrorHelper';

/**
 * Server-Authoritative Cryptographic Participant QR Issuance Endpoint
 * 
 * Enforces:
 * 1. Multi-factor session verification via Firebase ID Token.
 * 2. Strict RBAC & Ownership: ONLY Chief Admin or the participant's assigned Team Manager can issue/retrieve QR credentials.
 * 3. Never leaks cryptographic signing secrets to client or network.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!idToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication token is required to obtain participant accreditation QR.' },
        { status: 401 }
      );
    }

    const { id: participantId } = await params;
    if (!participantId) {
      return NextResponse.json(
        { error: 'Validation Error: Participant ID parameter is required.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database Unavailable: Could not connect to authoritative Firestore.' },
        { status: 503 }
      );
    }

    // 1. Fetch participant document to determine team ownership
    const partDoc = await db.collection('participants').doc(participantId).get();
    if (!partDoc.exists) {
      return NextResponse.json(
        { error: `Participant "${participantId}" not found.` },
        { status: 404 }
      );
    }

    const partData = partDoc.data()!;
    const teamId = partData.teamId || '';
    const bib = partData.bib || '';

    if (!bib) {
      return NextResponse.json(
        { error: `Validation Error: Participant "${participantId}" lacks an assigned bib number.` },
        { status: 400 }
      );
    }

    // 2. Strict Authorization Guard: Admin or matching Team Manager only
    await AuthService.assertTeamManager(idToken, teamId);

    // 3. Cryptographically sign QR credentials using the private server secret
    const { token, payload } = QrSignerService.signParticipantQr(participantId, bib);

    return NextResponse.json({
      success: true,
      participantId,
      bib,
      token,
      payload,
      qrPayload: payload
    });
  } catch (error) {
    return handleApiError(error);
  }
}
