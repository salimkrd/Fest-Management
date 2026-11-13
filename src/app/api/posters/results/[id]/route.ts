import { NextRequest, NextResponse } from 'next/server';
import { syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { PosterService } from '@/services/posterService';
import { adminToken, posterBody, posterError, privateHeaders } from '../../_helpers';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await syncWorkloadIdentityToken();
    const token = adminToken(request);
    const { id } = await context.params;
    const body = await posterBody(request);
    const poster = await PosterService.saveResult(token, id, { config: body.config, release: body.release });
    return NextResponse.json({ poster }, { headers: privateHeaders });
  } catch (error) { return posterError(error); }
}
