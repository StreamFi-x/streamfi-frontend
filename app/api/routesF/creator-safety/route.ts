import { NextRequest, NextResponse } from 'next/server';
import { getReportsForCreator, getModActionsForCreator, getActivityForCreator } from './safetyData';
import { calculateSafetyScore } from './calculateSafetyScore';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get('creator_id');

  if (!creatorId) {
    return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
  }

  const reports = getReportsForCreator(creatorId);
  const modActions = getModActionsForCreator(creatorId);
  const activity = getActivityForCreator(creatorId);

  const result = calculateSafetyScore(reports, modActions, activity);

  return NextResponse.json(result);
}