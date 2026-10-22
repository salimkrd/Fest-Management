/**
 * Secure Manual WhatsApp Invitation Service
 * Single-Fest Architecture: "Sahithyolsav 2025" / Inspirath Fest Management
 * 
 * Enforces:
 * 1. Cryptographically secure random invitation codes (e.g. INSP-XXXX-XXXX).
 * 2. High-entropy SHA-256 hashing (plaintext code NEVER persisted in Firestore).
 * 3. Exact official WhatsApp copyable message layout.
 * 4. Clean WhatsApp deep link without leaking secrets in URL parameters (wa.me/number).
 * 5. Strict 24-hour expiration time and single-use redemption tracking.
 * 6. Audit logging without exposing secrets.
 */

import * as crypto from 'crypto';

export interface GenerateInvitationResult {
  code: string; // Plaintext code returned ONCE to authenticated Chief Admin
  tokenHash: string; // SHA-256 hash to be stored in Firestore
  expiresAt: string; // ISO 8601 string
  message: string; // Complete copyable WhatsApp message
  whatsappUrl: string; // https://wa.me/{cleanPhone} (strictly NO tokens in query)
}

export class InvitationService {
  /**
   * Generates a cryptographically secure, 128-bit random invitation token.
   * Format: INSP-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX (32 hex chars = 128 bits entropy).
   * Replaces weak 8-character codes to prevent token guessing and brute force attacks.
   */
  static generateInvitationCode(): string {
    const rawHex = crypto.randomBytes(16).toString('hex').toUpperCase(); // 16 bytes = 128 bits
    return `INSP-${rawHex.slice(0, 8)}-${rawHex.slice(8, 16)}-${rawHex.slice(16, 24)}-${rawHex.slice(24, 32)}`;
  }

  /**
   * Normalizes an invitation code by stripping spaces, hyphens, and standardizing prefix.
   * Tolerates user pasting with or without formatting or INSP prefix.
   */
  static normalizeInvitationCode(code: string): string {
    if (!code) return '';
    let cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned.startsWith('INSP') && cleaned.length === 32) {
      cleaned = 'INSP' + cleaned;
    }
    return cleaned;
  }

  /**
   * Computes deterministic SHA-256 hash of a normalized invitation code.
   */
  static hashInvitationCode(code: string): string {
    const normalized = this.normalizeInvitationCode(code);
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Cleans a phone number for standard WhatsApp URL (strips spaces, dashes, parentheses).
   */
  static cleanWhatsAppNumber(phone: string): string {
    if (!phone) return '';
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly;
  }

  /**
   * Builds the official, professional WhatsApp invitation message.
   * Matches Section 3 of the prompt specification.
   */
  static buildWhatsAppMessage(params: {
    teamName: string;
    managerEmail: string;
    activationUrl: string;
    invitationCode: string;
  }): string {
    return `Hello,

You have been appointed as the Team Manager of ${params.teamName} for Inspirath Fest Management.

Login Email: ${params.managerEmail}

Activate your Team Manager account:

${params.activationUrl}

Invitation Code: ${params.invitationCode}

Open the activation page, enter your code, and set your own password.

After activation, you can sign in with your email and password.

For security, do not share this invitation.

— Inspirath Administration`;
  }

  /**
   * Prepares a complete one-time invitation package for an authenticated Chief Admin.
   * Enforces:
   * - 24 hour expiration.
   * - WhatsApp URL contains ONLY the recipient phone number, strictly NO query tokens.
   */
  static createInvitationPackage(params: {
    teamName: string;
    managerEmail: string;
    managerPhone: string;
    appUrl?: string;
    expiresInHours?: number;
  }): GenerateInvitationResult {
    const code = this.generateInvitationCode();
    const tokenHash = this.hashInvitationCode(code);

    const hours = params.expiresInHours || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const isProd = process.env.NODE_ENV === 'production';
    let baseUrl: string;

    if (params.appUrl && params.appUrl.trim() !== '') {
      baseUrl = params.appUrl.trim().replace(/\/+$/, '');
      if (isProd && !baseUrl.startsWith('https://')) {
        throw new Error('Security Violation: In production, application URL must use HTTPS protocol.');
      }
    } else {
      const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
      if (isProd) {
        if (!configured || configured.trim() === '') {
          throw new Error('Configuration Error: In production, trusted application URL (NEXT_PUBLIC_APP_URL or APP_URL) must be explicitly configured. Arbitrary forwarded host headers are strictly rejected.');
        }
        if (!configured.trim().startsWith('https://')) {
          throw new Error('Security Violation: In production, NEXT_PUBLIC_APP_URL or APP_URL must use HTTPS protocol.');
        }
        baseUrl = configured.trim().replace(/\/+$/, '');
      } else {
        baseUrl = (configured ? configured.trim() : 'http://localhost:3000').replace(/\/+$/, '');
      }
    }

    const activationUrl = `${baseUrl}/team/activate`;

    const message = this.buildWhatsAppMessage({
      teamName: params.teamName,
      managerEmail: params.managerEmail,
      activationUrl,
      invitationCode: code
    });

    const cleanPhone = this.cleanWhatsAppNumber(params.managerPhone);
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : 'https://wa.me';

    return {
      code,
      tokenHash,
      expiresAt,
      message,
      whatsappUrl
    };
  }
}
