import { NextRequest, NextResponse } from 'next/server';
import { PosterService } from '@/services/posterService';
import { adminToken, posterBody, posterError, privateHeaders } from '../_helpers';

export async function GET(request: NextRequest) {
  try {
    const templates = await PosterService.listTemplates(adminToken(request));
    return NextResponse.json({ templates }, { headers: privateHeaders });
  } catch (error) { return posterError(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const token = adminToken(request);
    const body = await posterBody(request);
    const templates = await PosterService.saveTemplate(token, body.template);
    return NextResponse.json({ templates }, { headers: privateHeaders });
  } catch (error) { return posterError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const templates = await PosterService.deleteTemplate(adminToken(request), request.nextUrl.searchParams.get('id') || '');
    return NextResponse.json({ templates }, { headers: privateHeaders });
  } catch (error) { return posterError(error); }
}
