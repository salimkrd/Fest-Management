/**
 * Theme Service
 * Enforces admin-only writes on public festival branding.
 * Public visitors receive read-only theme parameters.
 */

import { getAdminDb } from '@/lib/firebase/admin';
import { PublicThemeSettings } from '@/types/fest';
import { AuthService } from './authService';

export class ThemeService {
  /**
   * Public operation: Fetches the published festival theme settings.
   */
  static async getPublishedTheme(): Promise<PublicThemeSettings | null> {
    const db = getAdminDb();
    if (!db) return null;

    const doc = await db.collection('settings').doc('publicTheme').get();
    if (!doc.exists) return null;

    return doc.data() as PublicThemeSettings;
  }

  /**
   * Admin-only operation: Saves and publishes theme updates.
   * Cryptographically verifies Admin ID token before permitting changes.
   * Client-supplied user IDs cannot authorize this operation.
   */
  static async updateTheme(
    newTheme: Partial<PublicThemeSettings>,
    adminIdToken: string
  ): Promise<boolean> {
    if (!adminIdToken || typeof adminIdToken !== 'string') {
      throw new Error('Unauthorized: Valid Admin ID token is required to modify festival theme.');
    }

    const adminUser = await AuthService.assertAdmin(adminIdToken);

    const db = getAdminDb();
    if (!db) return true;

    await db.collection('settings').doc('publicTheme').set(
      {
        ...newTheme,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser.uid
      },
      { merge: true }
    );

    return true;
  }
}
