import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema, paginationSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureRecordingSchema } from "./_lib/db";

const visibilitySchema = z.enum(["public", "unlisted", "private"]);

const updateRecordingSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  visibility: visibilitySchema.optional(),
  thumbnail_url: z.string().url().optional(),
});

const deleteRecordingSchema = z.object({
  confirm: z.boolean().refine(v => v === true, {
    message: "Must confirm deletion with confirm: true",
  }),
});

const listRecordingsQuerySchema = paginationSchema;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, listRecordingsQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureRecordingSchema();

    const limit = queryResult.data.limit ?? 20;
    const cursor = queryResult.data.cursor;

    let queryResult2;

    if (cursor) {
      queryResult2 = await sql`
        SELECT id, mux_playback_id, title, visibility, thumbnail_url, duration_seconds, created_at
        FROM route_f_stream_recordings
        WHERE user_id = ${session.userId} AND created_at < (
          SELECT created_at FROM route_f_stream_recordings WHERE id = ${cursor}
        )
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    } else {
      queryResult2 = await sql`
        SELECT id, mux_playback_id, title, visibility, thumbnail_url, duration_seconds, created_at
        FROM route_f_stream_recordings
        WHERE user_id = ${session.userId}
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    }

    const rows = queryResult2.rows;
    const hasMore = rows.length > limit;
    const recordings = rows.slice(0, limit);
    const nextCursor = hasMore ? recordings[recordings.length - 1]?.id : null;

    return NextResponse.json({
      recordings: recordings.map((r: any) => ({
        id: r.id,
        mux_playback_id: r.mux_playback_id,
        title: r.title,
        visibility: r.visibility,
        thumbnail_url: r.thumbnail_url ?? null,
        duration_seconds: r.duration_seconds ?? null,
        created_at: r.created_at,
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error("[stream/recording] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { pathname } = new URL(req.url);
  const recordingId = pathname.split("/").pop();

  if (!recordingId || !uuidSchema.safeParse(recordingId).success) {
    return NextResponse.json(
      { error: "Invalid recording ID" },
      { status: 400 }
    );
  }

  const bodyResult = await validateBody(req, updateRecordingSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureRecordingSchema();

    // Verify ownership
    const { rows: ownerRows } = await sql`
      SELECT id FROM route_f_stream_recordings
      WHERE id = ${recordingId} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (ownerRows.length === 0) {
      return NextResponse.json(
        { error: "Recording not found or unauthorized" },
        { status: 404 }
      );
    }

    const { title, visibility, thumbnail_url } = bodyResult.data;

    const { rows } = await sql`
      UPDATE route_f_stream_recordings
      SET
        title = COALESCE(${title ?? null}, title),
        visibility = COALESCE(${visibility ?? null}, visibility),
        thumbnail_url = COALESCE(${thumbnail_url ?? null}, thumbnail_url),
        updated_at = now()
      WHERE id = ${recordingId}
      RETURNING id, mux_playback_id, title, visibility, thumbnail_url, duration_seconds, created_at
    `;

    const updated = rows[0];
    return NextResponse.json({
      id: updated.id,
      mux_playback_id: updated.mux_playback_id,
      title: updated.title,
      visibility: updated.visibility,
      thumbnail_url: updated.thumbnail_url ?? null,
      duration_seconds: updated.duration_seconds ?? null,
      created_at: updated.created_at,
    });
  } catch (error) {
    console.error("[stream/recording] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { pathname } = new URL(req.url);
  const recordingId = pathname.split("/").pop();

  if (!recordingId || !uuidSchema.safeParse(recordingId).success) {
    return NextResponse.json(
      { error: "Invalid recording ID" },
      { status: 400 }
    );
  }

  const bodyResult = await validateBody(req, deleteRecordingSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureRecordingSchema();

    // Verify ownership
    const { rows: ownerRows } = await sql`
      SELECT id FROM route_f_stream_recordings
      WHERE id = ${recordingId} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (ownerRows.length === 0) {
      return NextResponse.json(
        { error: "Recording not found or unauthorized" },
        { status: 404 }
      );
    }

    await sql`
      DELETE FROM route_f_stream_recordings
      WHERE id = ${recordingId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[stream/recording] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
