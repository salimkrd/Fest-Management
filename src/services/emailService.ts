/**
 * Deprecated Email Service (Migrated to Secure Manual WhatsApp Onboarding)
 * 
 * In accordance with Phase 3 Checkpoint 3 requirements:
 * The automatic Resend/SMTP email delivery workflow has been decommissioned in favor of
 * the secure manual WhatsApp invitation workflow managed via InvitationService.
 * 
 * No RESEND_API_KEY, EMAIL_PROVIDER, or EMAIL_FROM_ADDRESS environment variables are required.
 */

export interface SendManagerInvitationParams {
  managerEmail: string;
  managerName: string;
  teamName: string;
  teamCode: string;
  invitationLink: string;
  zone?: string;
  expiresInHours?: number;
}

export interface EmailDeliveryResult {
  success: boolean;
  provider: 'none';
  status: 'PENDING';
  messageId?: string;
  error?: string;
  timestamp: string;
}

export class EmailService {
  /**
   * Helper to securely mask email addresses for logs (e.g. j***n@domain.com)
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return Boolean(email && emailRegex.test(email.trim()));
  }

  /**
   * Deprecated stub
   */
  static async sendManagerInvitation(params: SendManagerInvitationParams): Promise<EmailDeliveryResult> {
    return {
      success: true,
      provider: 'none',
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
  }
}
