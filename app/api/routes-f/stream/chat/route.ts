import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '../../_lib/validate';
import { z } from 'zod';
import { setChatRestriction, getChatRestriction, disableChatRestriction, validateMinFollowMinutes } from './utils';
import type { ChatRestrictionRequestBody, ChatRestrictionResponse, ChatRestrictionState } from './types';

const chatRestrictionSchema = z.object({
  stream_id: z.string().min(1),
  min_follow_minutes: z.number().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, chatRestrictionSchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as ChatRestrictionRequestBody;
  const minFollowMinutes = body.min_follow_minutes ?? 10;
  
  const validationCheck = validateMinFollowMinutes(minFollowMinutes);
  if (!validationCheck.valid) {
    return NextResponse.json({ error: validationCheck.error }, { status: 400 });
  }

  const data = setChatRestriction(body.stream_id, minFollowMinutes);
  return NextResponse.json({
    enabled: data.enabled,
    min_follow_minutes: data.min_follow_minutes
  } as ChatRestrictionResponse);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get('stream_id');
  
  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  disableChatRestriction(streamId);
  return NextResponse.json({ enabled: false });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get('stream_id');
  
  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  const data = getChatRestriction(streamId);
  
  if (!data) {
    return NextResponse.json({ enabled: false } as ChatRestrictionState);
  }

  return NextResponse.json({
    enabled: data.enabled,
    min_follow_minutes: data.min_follow_minutes
  } as ChatRestrictionState);
}
