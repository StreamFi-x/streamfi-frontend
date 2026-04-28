import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { canRequestSnapshot, setSnapshot } from "../_lib/store";

const SNAPSHOT_WINDOW_MS = 30_000;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    const { rows } = await sql`
      SELECT id, username, is_live, mux_playback_id
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.is_live) {
      return NextResponse.json(
        { error: "Snapshot available only while live" },
        { status: 400 }
      );
    }

    const playbackId =
      typeof user.mux_playback_id === "string" ? user.mux_playback_id : "";
    if (!playbackId) {
      return NextResponse.json(
        { error: "No active playback ID for stream" },
        { status: 400 }
      );
    }

    const rateResult = canRequestSnapshot(playbackId, SNAPSHOT_WINDOW_MS);
    if (!rateResult.allowed) {
      return NextResponse.json(
        {
          error: "Snapshot rate limit exceeded",
          retry_after_seconds: rateResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfterSeconds) },
        }
      );
    }

    const snapshotUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=now`;
    await fetch(snapshotUrl, { method: "HEAD", cache: "no-store" });
    const snapshot = setSnapshot(playbackId, snapshotUrl, SNAPSHOT_WINDOW_MS);

    return NextResponse.json({
      type: "mux_snapshot",
      url: snapshot.url,
      generated_at: snapshot.generatedAt,
      is_live: true,
      username: user.username,
    });
  } catch (error) {
    console.error("[routes-f/preview/snapshot] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate snapshot" },
      { status: 500 }
    );
  }
}
