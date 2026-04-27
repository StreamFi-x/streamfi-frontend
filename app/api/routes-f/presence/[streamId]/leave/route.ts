import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/routes-f/presence/[streamId]/leave
// Explicit viewer leave — removes them from the sorted set immediately.
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ streamId: string }> }
) {
  const { streamId } = await context.params;

  let body: { viewer_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const viewerId = body.viewer_id;
  if (!viewerId) {
    return NextResponse.json(
      { error: "viewer_id is required." },
      { status: 400 }
    );
  }

  const viewers: Map<string, { lastSeen: number }> | undefined =
    (globalThis as any).__streamfi_presence?.get(streamId);

  if (viewers) {
    viewers.delete(viewerId);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
