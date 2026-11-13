import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminDb } from './src/lib/firebase/admin';

const PRODUCTION_PROJECT_ID = 'inspirath-d6778';

export async function proxy(_request: NextRequest) {
  void _request;
  const configuredProject =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Do not interfere with demo/staging preview deployments.
  if (configuredProject !== PRODUCTION_PROJECT_ID) {
    return NextResponse.next();
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Production maintenance status could not be verified.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Retry-After': '60',
            'X-Fest-Maintenance': 'unavailable'
          }
        }
      );
    }

    const lock = await db.doc('settings/bootstrapLock').get();
    if (lock.exists && lock.get('maintenanceMode') === true) {
      return NextResponse.json(
        { error: 'INSPIRATH is temporarily unavailable for a controlled festival reset.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Retry-After': '300',
            'X-Fest-Maintenance': 'enabled'
          }
        }
      );
    }

    return NextResponse.next();
  } catch (error) {
    console.error('[Production maintenance guard] Could not read bootstrap lock:', error);
    return NextResponse.json(
      { error: 'Production maintenance status could not be verified.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Retry-After': '60',
          'X-Fest-Maintenance': 'unavailable'
        }
      }
    );
  }
}

export const config = {
  matcher: ['/api/:path*']
};
