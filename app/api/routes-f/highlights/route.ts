import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureHighlightsSchema } from "./_lib/db";

const MAX_CLIP_LENGTH_SECONDS = 90;

const createHighlightSchema = z.object({
  recording_id: uuidSchema,
  start_offset: z.number().int().min(0),
  end_offset: z.number().int().min(1),
  title: z.string().trim().min(1).max(120),
});

function buildPlaybackUrl(
  playbackId: string,
  startOffset: number,
  endOffset: number
): string {
  const params = new URLSearchParams({
    asset_type: "clip",
    start: String(startOffset),
    end: String(endOffset),
  });

  return `https://stream.mux.com/${playbackId}.m3u8?${params.toString()}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureHighlightsSchema();

    const { rows } = await sql`
      SELECT
        h.id,
        h.recording_id,
        h.title,
        h.start_offset,
        h.end_offset,
        h.playback_url,
        h.created_at,
        r.playback_id,
        r.duration,
        r.title AS recording_title
      FROM route_f_highlights h
      JOIN stream_recordings r ON r.id = h.recording_id
      WHERE h.user_id = ${session.userId}
      ORDER BY h.created_at DESC
    `;

    return NextResponse.json({ highlights: rows });
  } catch (error) {
    console.error("[highlights] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createHighlightSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { recording_id, start_offset, end_offset, title } = bodyResult.data;

  if (start_offset >= end_offset) {
    return NextResponse.json(
      { error: "start_offset must be less than end_offset" },
      { status: 400 }
    );
  }

  if (end_offset - start_offset > MAX_CLIP_LENGTH_SECONDS) {
    return NextResponse.json(
      {
        error: `Highlight clips may not exceed ${MAX_CLIP_LENGTH_SECONDS} seconds`,
      },
      { status: 400 }
    );
  }

  try {
    await ensureHighlightsSchema();

    const { rows: recordingRows } = await sql`
      SELECT id, user_id, playback_id, duration, title, status
      FROM stream_recordings
      WHERE id = ${recording_id}
      LIMIT 1
    `;

    if (recordingRows.length === 0) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const recording = recordingRows[0];

    if (recording.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!recording.playback_id) {
      return NextResponse.json(
        { error: "Recording playback is not ready" },
        { status: 409 }
      );
    }

    if (
      typeof recording.duration === "number" &&
      end_offset > recording.duration
    ) {
      return NextResponse.json(
        { error: "end_offset exceeds recording duration" },
        { status: 400 }
      );
    }

    const playbackUrl = buildPlaybackUrl(
      recording.playback_id,
      start_offset,
      end_offset
    );

    const { rows } = await sql`
      INSERT INTO route_f_highlights (
        recording_id,
        user_id,
        title,
        start_offset,
        end_offset,
        playback_url
      )
      VALUES (
        ${recording_id},
        ${session.userId},
        ${title},
        ${start_offset},
        ${end_offset},
        ${playbackUrl}
      )
      RETURNING id, recording_id, user_id, title, start_offset, end_offset, playback_url, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[highlights] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
