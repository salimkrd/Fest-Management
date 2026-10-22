import { NextRequest, NextResponse } from 'next/server';
import { JudgeService } from '@/services/judgeService';

/**
 * Server API Endpoint for Judge Mark Recording
 * Authenticates judge PIN / secret, verifies live assignment, scope, expiration,
 * and executes strictly through JudgeService with full registration and rubric validation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, assignmentId, competitionId, secret, scores, remarks } = body;

    if (!assignmentId || !competitionId || !secret || !scores) {
      return NextResponse.json(
        { error: 'Bad Request: assignmentId, competitionId, secret, and scores are required.' },
        { status: 400 }
      );
    }

    if (action === 'DRAFT') {
      const result = await JudgeService.saveDraftMarks({
        assignmentId,
        competitionId,
        secret,
        scores,
        remarks
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'SUBMIT') {
      const result = await JudgeService.submitMarks({
        assignmentId,
        competitionId,
        secret,
        scores
      });
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Bad Request: action must be DRAFT or SUBMIT.' },
      { status: 400 }
    );
  } catch (error: any) {
    const message = error?.message || 'Internal Server Error';
    const isAuthError = message.toLowerCase().includes('unauthorized');
    const isValidationError = message.toLowerCase().includes('validation error');
    const status = isAuthError ? 401 : isValidationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
