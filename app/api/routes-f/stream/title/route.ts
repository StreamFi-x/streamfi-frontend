import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '@/app/api/routes-f/_lib/validate';
import { z } from 'zod';
import { addTitleChange, getTitleHistory, validateTitle } from './utils';
import type { StreamTitleRequestBody, StreamTitleResponse, StreamTitleHistoryResponse } from './types';

const streamTitleSchema = z.object({
  stream_id: z.string().min(1),
  title: z.string(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, streamTitleSchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as StreamTitleRequestBody;
  const titleValidation = validateTitle(body.title);

  if (!titleValidation.valid) {
    return NextResponse.json({ error: titleValidation.error }, { status: 400 });
  }

  const entry = addTitleChange(body.stream_id, body.title);
  return NextResponse.json({
    updated_at: entry.updated_at,
    title: entry.title
  } as StreamTitleResponse);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get('stream_id');
  
  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  const history = getTitleHistory(streamId);
  return NextResponse.json({ history } as StreamTitleHistoryResponse);
}
