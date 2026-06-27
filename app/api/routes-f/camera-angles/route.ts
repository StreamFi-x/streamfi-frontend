import { NextRequest, NextResponse } from "next/server";
import { findAngle, getStreamById } from "./seed";
import { setViewerAngle } from "./store";
import type {
  AnglesListResponse,
  SelectAngleBody,
  SelectAngleResponse,
} from "./types";

/**
 * GET /api/routes-f/camera-angles?stream_id=stream_multi_1
 *
 * Lists available camera angles for a multi-angle stream.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");
  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const stream = getStreamById(streamId);
  if (!stream) {
    return NextResponse.json(
      { error: `unknown stream_id: ${streamId}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    angles: stream.angles,
  } satisfies AnglesListResponse);
}

/**
 * POST /api/routes-f/camera-angles
 * Body: { viewer_id, stream_id, angle_id }
 *
 * Stores the viewer's selected camera angle for a stream.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SelectAngleBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, stream_id, angle_id } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }
  if (!angle_id || typeof angle_id !== "string") {
    return NextResponse.json(
      { error: "angle_id is required" },
      { status: 400 }
    );
  }

  const match = findAngle(stream_id, angle_id);
  if (!match) {
    const stream = getStreamById(stream_id);
    if (!stream) {
      return NextResponse.json(
        { error: `unknown stream_id: ${stream_id}` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: `unknown angle_id: ${angle_id}` },
      { status: 400 }
    );
  }

  setViewerAngle(viewer_id, stream_id, angle_id);

  return NextResponse.json({
    viewer_id,
    stream_id,
    angle_id,
  } satisfies SelectAngleResponse);
}
