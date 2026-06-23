import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '../../_lib/validate';
import { z } from 'zod';
import { updateStreamTags, getStreamTags } from './utils';
import type { StreamTagsRequestBody, StreamTagsResponse } from './types';

const streamTagsSchema = z.object({
  stream_id: z.string().min(1),
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, streamTagsSchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as StreamTagsRequestBody;
  const result = updateStreamTags(body.stream_id, body.add, body.remove);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ tags: result.tags } as StreamTagsResponse);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get('stream_id');
  
  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  const tags = getStreamTags(streamId);
  return NextResponse.json({ tags } as StreamTagsResponse);
}
