import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { insertActivityEvent } from "@/app/api/routes-f/activity/_lib/insert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Practice implementation of stream go-live for routes-f.
 * Inserts a stream_started activity event for the authenticated creator.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: { stream_title?: unknown; peak_viewers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stream_title =
    typeof body.stream_title === "string" && body.stream_title.trim()
      ? body.stream_title.trim()
      : "Untitled Stream";
  const peak_viewers =
    typeof body.peak_viewers === "number" && body.peak_viewers >= 0
      ? body.peak_viewers
      : 0;

  try {
    const { rows } = await sql<{ username: string }>`
      SELECT username FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: event_id } = await insertActivityEvent({
      userId: session.userId,
      type: "stream_started",
      actorId: session.userId,
      metadata: {
        stream_title,
        peak_viewers,
        username: rows[0].username,
      },
    });

    return NextResponse.json(
      { event_id, type: "stream_started", stream_title },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f streams/start POST]", error);
    return NextResponse.json(
      { error: "Failed to start stream activity" },
      { status: 500 }
    );
  }
}
