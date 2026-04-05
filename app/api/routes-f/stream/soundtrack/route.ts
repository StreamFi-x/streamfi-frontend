import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureSoundtrackSchema } from "./_lib/db";

const streamIdSchema = z.object({
  stream_id: uuidSchema,
});

const playTrackSchema = z.object({
  track_id: uuidSchema,
  stream_id: uuidSchema,
});

const skipTrackSchema = z.object({
  stream_id: uuidSchema,
});

const stopPlaybackSchema = z.object({
  stream_id: uuidSchema,
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, streamIdSchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureSoundtrackSchema();

    const { stream_id } = queryResult.data;

    // Get now playing track
    const { rows: nowPlayingRows } = await sql`
      SELECT
        np.id,
        np.track_id,
        sc.title,
        sc.artist,
        sc.duration_seconds,
        np.started_at
      FROM route_f_stream_now_playing np
      JOIN route_f_soundtrack_catalog sc ON np.track_id = sc.id
      WHERE np.stream_id = ${stream_id} AND np.user_id = ${session.userId}
      LIMIT 1
    `;

    // Get playlist
    const { rows: playlistRows } = await sql`
      SELECT
        sp.id,
        sp.track_id,
        sp.position,
        sc.title,
        sc.artist,
        sc.duration_seconds
      FROM route_f_stream_playlists sp
      JOIN route_f_soundtrack_catalog sc ON sp.track_id = sc.id
      WHERE sp.stream_id = ${stream_id} AND sp.user_id = ${session.userId}
      ORDER BY sp.position ASC
    `;

    return NextResponse.json({
      now_playing:
        nowPlayingRows.length > 0
          ? {
              track_id: nowPlayingRows[0].track_id,
              title: nowPlayingRows[0].title,
              artist: nowPlayingRows[0].artist,
              duration_seconds: nowPlayingRows[0].duration_seconds,
              started_at: nowPlayingRows[0].started_at,
            }
          : null,
      playlist: playlistRows.map(row => ({
        id: row.id,
        track_id: row.track_id,
        position: row.position,
        title: row.title,
        artist: row.artist,
        duration_seconds: row.duration_seconds,
      })),
    });
  } catch (error) {
    console.error("[stream/soundtrack] GET error:", error);
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

  const bodyResult = await validateBody(req, playTrackSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureSoundtrackSchema();

    const { track_id, stream_id } = bodyResult.data;

    // Verify track exists
    const { rows: trackRows } = await sql`
      SELECT id FROM route_f_soundtrack_catalog WHERE id = ${track_id} LIMIT 1
    `;

    if (trackRows.length === 0) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Upsert now playing
    const { rows } = await sql`
      INSERT INTO route_f_stream_now_playing (stream_id, user_id, track_id, started_at, updated_at)
      VALUES (${stream_id}, ${session.userId}, ${track_id}, now(), now())
      ON CONFLICT (stream_id) DO UPDATE SET
        track_id = EXCLUDED.track_id,
        started_at = now(),
        updated_at = now()
      RETURNING track_id, started_at
    `;

    return NextResponse.json({
      track_id: rows[0].track_id,
      started_at: rows[0].started_at,
    });
  } catch (error) {
    console.error("[stream/soundtrack] POST play error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { pathname } = new URL(req.url);
  const action = pathname.split("/").pop();

  if (action === "skip") {
    const bodyResult = await validateBody(req, skipTrackSchema);
    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    try {
      await ensureSoundtrackSchema();

      const { stream_id } = bodyResult.data;

      // Get current position in playlist
      const { rows: currentRows } = await sql`
        SELECT np.track_id, sp.position
        FROM route_f_stream_now_playing np
        LEFT JOIN route_f_stream_playlists sp ON sp.track_id = np.track_id AND sp.stream_id = np.stream_id
        WHERE np.stream_id = ${stream_id} AND np.user_id = ${session.userId}
        LIMIT 1
      `;

      if (currentRows.length === 0) {
        return NextResponse.json(
          { error: "No track currently playing" },
          { status: 400 }
        );
      }

      const currentPosition = currentRows[0].position ?? 0;

      // Get next track
      const { rows: nextRows } = await sql`
        SELECT track_id FROM route_f_stream_playlists
        WHERE stream_id = ${stream_id} AND user_id = ${session.userId} AND position > ${currentPosition}
        ORDER BY position ASC
        LIMIT 1
      `;

      if (nextRows.length === 0) {
        return NextResponse.json(
          { error: "No next track in playlist" },
          { status: 400 }
        );
      }

      // Update now playing
      const { rows } = await sql`
        UPDATE route_f_stream_now_playing
        SET track_id = ${nextRows[0].track_id}, started_at = now(), updated_at = now()
        WHERE stream_id = ${stream_id}
        RETURNING track_id, started_at
      `;

      return NextResponse.json({
        track_id: rows[0].track_id,
        started_at: rows[0].started_at,
      });
    } catch (error) {
      console.error("[stream/soundtrack] PUT skip error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  if (action === "stop") {
    const bodyResult = await validateBody(req, stopPlaybackSchema);
    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    try {
      await ensureSoundtrackSchema();

      const { stream_id } = bodyResult.data;

      await sql`
        DELETE FROM route_f_stream_now_playing
        WHERE stream_id = ${stream_id} AND user_id = ${session.userId}
      `;

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[stream/soundtrack] PUT stop error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
