import { NextResponse } from 'next/server';
import { PosterService } from '@/services/posterService';
import { posterError, privateHeaders } from '../_helpers';

export const dynamic = 'force-dynamic';

/** Public read-only endpoint. The service returns explicitly released templates only. */
export async function GET() {
  try {
    const templates = await PosterService.listReleasedTemplates();
    return NextResponse.json({ templates }, { headers: privateHeaders });
  } catch (error) {
    return posterError(error);
  }
}
