import { NextResponse } from 'next/server';

const MAX_VIEWERS_PER_CALL = 100;
const VALID_ACTIONS = ['ban', 'timeout'] as const;
type ModerationAction = (typeof VALID_ACTIONS)[number];

interface BatchModerationBody {
  creator_id?: unknown;
  action?: unknown;
  viewer_ids?: unknown;
  reason?: unknown;
  duration_seconds?: unknown;
}

export async function POST(request: Request) {
  try {
    const body: BatchModerationBody = await request.json().catch(() => null);

    if (!body || typeof body.creator_id !== 'string' || body.creator_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid creator_id' }, { status: 400 });
    }

    if (typeof body.action !== 'string' || !VALID_ACTIONS.includes(body.action as ModerationAction)) {
      return NextResponse.json({ error: 'action must be one of: ban, timeout' }, { status: 400 });
    }

    if (
      !Array.isArray(body.viewer_ids) ||
      body.viewer_ids.length === 0 ||
      !body.viewer_ids.every((id) => typeof id === 'string' && id.trim().length > 0)
    ) {
      return NextResponse.json({ error: 'viewer_ids must be a non-empty array of strings' }, { status: 400 });
    }

    if (body.viewer_ids.length > MAX_VIEWERS_PER_CALL) {
      return NextResponse.json(
        { error: `viewer_ids exceeds max of ${MAX_VIEWERS_PER_CALL} per call` },
        { status: 400 }
      );
    }

    const action = body.action as ModerationAction;

    if (action === 'timeout') {
      if (typeof body.duration_seconds !== 'number' || body.duration_seconds <= 0) {
        return NextResponse.json(
          { error: 'duration_seconds must be a positive number for timeout action' },
          { status: 400 }
        );
      }
    }

    if (body.reason !== undefined && typeof body.reason !== 'string') {
      return NextResponse.json({ error: 'reason must be a string' }, { status: 400 });
    }

    const uniqueViewerIds = Array.from(new Set(body.viewer_ids as string[]));

    return NextResponse.json({ applied_count: uniqueViewerIds.length });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
