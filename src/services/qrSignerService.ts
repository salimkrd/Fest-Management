/**
 * Server-Only Cryptographic QR Issuance & Verification Service
 * 
 * Enforces:
 * 1. Server-side HMAC-SHA256 cryptographic signing with private unexposed secret key.
 * 2. Absolute protection of the signing secret (never exposed to NEXT_PUBLIC_* or browser bundles).
 * 3. Constant-time token verification to prevent timing attacks.
 */

import { generateQrVerificationToken, verifyQrVerificationToken } from '@/domain/greenRoom';

export class QrSignerService {
  /**
   * Resolves the server-only private QR signing secret.
   * Mandates a dedicated, strong QR_SIGNING_SECRET in the server environment.
   * Falling back to unrelated secrets (e.g. Firebase or session secrets) or default keys is strictly prohibited.
   */
  static getSigningSecret(): string {
    const secret = process.env.QR_SIGNING_SECRET?.trim();

    if (!secret || secret.length < 32) {
      throw new Error(
        'Configuration Error: A dedicated, strong QR_SIGNING_SECRET (at least 32 characters) must be configured in server environment variables. Falling back to unrelated secrets or default keys is strictly prohibited.'
      );
    }

    return secret;
  }

  /**
   * Cryptographically signs participant accreditation credentials into an opaque, server-verified token.
   */
  static signParticipantQr(participantId: string, bib: string): { token: string; payload: string } {
    if (!participantId || !bib) {
      throw new Error('Validation Error: participantId and bib are required to sign QR credentials.');
    }

    const secretKey = this.getSigningSecret();
    const token = generateQrVerificationToken(participantId, bib, secretKey);
    const payload = JSON.stringify({
      app: 'INSPIRATH',
      type: 'PARTICIPANT_ID',
      id: participantId,
      bib,
      token,
      version: 3
    });

    return { token, payload };
  }

  /**
   * Verifies the authenticity and integrity of a participant's QR verification token.
   * Compares against the private server signing secret in constant time.
   */
  static verifyParticipantQrToken(participantId: string, bib: string, token: string): boolean {
    if (!participantId || !bib || !token) return false;
    const secretKey = this.getSigningSecret();
    return verifyQrVerificationToken(participantId, bib, token, secretKey);
  }
}
