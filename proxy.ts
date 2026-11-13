import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(_request: NextRequest) {
  if (process.env.FEST_RESET_MAINTENANCE !== '1') {
    return NextResponse.next();
  }

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

export const config = {
  matcher: ['/api/:path*']
};
