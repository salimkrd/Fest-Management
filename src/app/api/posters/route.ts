import { NextRequest, NextResponse } from 'next/server';
import { PosterService } from '@/services/posterService';
import { adminToken, posterError, privateHeaders } from './_helpers';

export async function GET(request: NextRequest) {
  try {
    const posters = request.nextUrl.searchParams.get('view') === 'admin'
      ? await PosterService.listAdmin(adminToken(request))
      : await PosterService.listReleased();
    return NextResponse.json({ posters }, { headers: privateHeaders });
  } catch (error) { return posterError(error); }
}
