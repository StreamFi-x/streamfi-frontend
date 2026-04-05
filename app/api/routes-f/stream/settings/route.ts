import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ── Validation constants ──────────────────────────────────────────────────────
const TITLE_MAX = 140;
const TAGS_MAX_COUNT = 5;
const TAG_MAX_LEN = 25;
const VALID_SLOW_MODES = [0, 3, 10, 30, 60] as const;

// ── GET /api/routes-f/stream/settings ────────────────────────────────────────
// Returns current stream settings for the authenticated creator.
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { rows } = await sql`
      SELECT
        creator,
        slow_mode_seconds,
        is_live
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { creator = {}, slow_mode_seconds, is_live } = rows[0];

    return NextResponse.json({
      settings: {
        title: creator.streamTitle ?? "",
        category: creator.category ?? "",
        tags: creator.tags ?? [],
        mature_content: creator.mature_content ?? false,
        chat_enabled: creator.chat_enabled ?? true,
        slow_mode_seconds: slow_mode_seconds ?? 0,
      },
      is_live,
    });
  } catch (err) {
    console.error("[stream/settings:GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/routes-f/stream/settings ──────────────────────────────────────
// Update stream settings. All fields are optional — only provided fields change.
// Changes take effect immediately (live or not).
export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: {
    title?: string;
    category?: string;
    tags?: string[];
    mature_content?: boolean;
    chat_enabled?: boolean;
    slow_mode_seconds?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    title,
    category,
    tags,
    mature_content,
    chat_enabled,
    slow_mode_seconds,
  } = body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (title !== undefined) {
    if (typeof title !== "string" || title.length > TITLE_MAX) {
      return NextResponse.json(
        { error: `title must be a string of at most ${TITLE_MAX} characters` },
        { status: 400 }
      );
    }
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > TAGS_MAX_COUNT) {
      return NextResponse.json(
        { error: `tags must be an array of at most ${TAGS_MAX_COUNT} items` },
        { status: 400 }
      );
    }
    const badTag = tags.find(
      t => typeof t !== "string" || t.length > TAG_MAX_LEN
    );
    if (badTag !== undefined) {
      return NextResponse.json(
        {
          error: `each tag must be a string of at most ${TAG_MAX_LEN} characters`,
        },
        { status: 400 }
      );
    }
  }

  if (slow_mode_seconds !== undefined) {
    if (!(VALID_SLOW_MODES as readonly number[]).includes(slow_mode_seconds)) {
      return NextResponse.json(
        {
          error: `slow_mode_seconds must be one of: ${VALID_SLOW_MODES.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  if (mature_content !== undefined && typeof mature_content !== "boolean") {
    return NextResponse.json(
      { error: "mature_content must be a boolean" },
      { status: 400 }
    );
  }

  if (chat_enabled !== undefined && typeof chat_enabled !== "boolean") {
    return NextResponse.json(
      { error: "chat_enabled must be a boolean" },
      { status: 400 }
    );
  }

  // ── Fetch current state ─────────────────────────────────────────────────────
  try {
    const { rows } = await sql`
      SELECT creator, slow_mode_seconds FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const current = rows[0];
    const currentCreator = current.creator ?? {};

    // Merge only provided fields
    const updatedCreator = {
      ...currentCreator,
      ...(title !== undefined && { streamTitle: title }),
      ...(category !== undefined && { category }),
      ...(tags !== undefined && { tags }),
      ...(mature_content !== undefined && { mature_content }),
      ...(chat_enabled !== undefined && { chat_enabled }),
    };

    const newSlowMode =
      slow_mode_seconds !== undefined
        ? slow_mode_seconds
        : current.slow_mode_seconds;

    await sql`
      UPDATE users SET
        creator           = ${JSON.stringify(updatedCreator)},
        slow_mode_seconds = ${newSlowMode},
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = ${session.userId}
    `;

    return NextResponse.json({
      ok: true,
      settings: {
        title: updatedCreator.streamTitle ?? "",
        category: updatedCreator.category ?? "",
        tags: updatedCreator.tags ?? [],
        mature_content: updatedCreator.mature_content ?? false,
        chat_enabled: updatedCreator.chat_enabled ?? true,
        slow_mode_seconds: newSlowMode,
      },
    });
  } catch (err) {
    console.error("[stream/settings:PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
