import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '../../_lib/validate';
import { z } from 'zod';
import { setIntermission, getIntermission, clearIntermission, getSecondsRemaining } from './utils';
import type { IntermissionRequestBody, IntermissionResponse, IntermissionState } from './types';

const intermissionSchema = z.object({
  stream_id: z.string().min(1),
  message: z.string().min(1),
  ends_at: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, intermissionSchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as IntermissionRequestBody;
  
  // Validate ends_at is valid ISO date if provided
  if (body.ends_at) {
    const endDate = new Date(body.ends_at);
    if (isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'ends_at must be a valid ISO date' }, { status: 400 });
    }
  }

  setIntermission(body.stream_id, body.message, body.ends_at);
  return NextResponse.json({ active: true } as IntermissionResponse);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get('stream_id');
  
  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  clearIntermission(streamId);
  return NextResponse.json({ active: false });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get('stream_id');
  
  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  const data = getIntermission(streamId);
  
  if (!data) {
    return NextResponse.json({ active: false } as IntermissionState);
  }

  const response: IntermissionState = {
    active: data.active,
    message: data.message,
    ends_at: data.ends_at,
  };

  if (data.ends_at) {
    response.seconds_remaining = getSecondsRemaining(data.ends_at);
  }

  return NextResponse.json(response);
}
