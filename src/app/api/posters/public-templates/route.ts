import { NextResponse } from 'next/server';
import { syncWorkloadIdentityToken } from '@/lib/firebase/admin';
import { PosterService } from '@/services/posterService';
import { posterError, privateHeaders } from '../_helpers';

export const dynamic = 'force-dynamic';

/** Public read-only endpoint. The service returns explicitly released templates only. */
export async function GET() {
  try {
    await syncWorkloadIdentityToken();
    const templates = await PosterService.listReleasedTemplates();
    return NextResponse.json({ templates }, { headers: privateHeaders });
  } catch (error) {
    return posterError(error);
  }
}
