import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const itemTypeSchema = z.enum(["stream", "recording", "clip"]);

const createWatchlistSchema = z.object({
  item_id: z.string().min(1),
  item_type: itemTypeSchema,
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

type WatchlistRow = {
  id: string;
  item_id: string;
  item_type: "stream" | "recording" | "clip";
  created_at: string;
};

async function ensureWatchlistTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_watchlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('stream', 'recording', 'clip')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, item_id, item_type)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_created
    ON user_watchlist (user_id, created_at DESC)
  `;
}

async function itemExists(
  itemId: string,
  itemType: "stream" | "recording" | "clip"
) {
  if (itemType === "stream") {
    const { rows } = await sql`
      SELECT id FROM users WHERE id = ${itemId} LIMIT 1
    `;
    return rows.length > 0;
  }

  const { rows } = await sql`
    SELECT id
    FROM stream_recordings
    WHERE id = ${itemId}
      AND status = 'ready'
    LIMIT 1
  `;
  return rows.length > 0;
}

async function enforceWatchlistLimit(userId: string) {
  const { rows } = await sql`
    SELECT COUNT(*)::int AS total
    FROM user_watchlist
    WHERE user_id = ${userId}
  `;

  const total = Number(rows[0]?.total ?? 0);
  return total < 200;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, listSchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { limit, cursor } = queryResult.data;

  try {
    await ensureWatchlistTable();

    const { rows } = cursor
      ? await sql<WatchlistRow>`
          SELECT id, item_id, item_type, created_at
          FROM user_watchlist
          WHERE user_id = ${session.userId}
            AND created_at < (SELECT created_at FROM user_watchlist WHERE id = ${cursor} LIMIT 1)
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await sql<WatchlistRow>`
          SELECT id, item_id, item_type, created_at
          FROM user_watchlist
          WHERE user_id = ${session.userId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    const itemChecks = await Promise.all(
      rows.map(async row => ({
        ...row,
        exists: await itemExists(row.item_id, row.item_type),
      }))
    );

    const staleItems = itemChecks.filter(item => !item.exists);
    if (staleItems.length > 0) {
      await Promise.all(
        staleItems.map(
          item => sql`DELETE FROM user_watchlist WHERE id = ${item.id}`
        )
      );
    }

    const validItems = itemChecks
      .filter(item => item.exists)
      .map(item => ({
        id: item.id,
        item_id: item.item_id,
        item_type: item.item_type,
        created_at: item.created_at,
      }));

    const nextCursor =
      validItems.length === limit
        ? (validItems[validItems.length - 1].id as string)
        : null;

    return NextResponse.json({
      watchlist: validItems,
      next_cursor: nextCursor,
    });
  } catch (err) {
    console.error("[watchlist] GET error:", err);
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

  const bodyResult = await validateBody(req, createWatchlistSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { item_id, item_type } = bodyResult.data;

  try {
    await ensureWatchlistTable();

    if (!(await enforceWatchlistLimit(session.userId))) {
      return NextResponse.json(
        { error: "Watchlist limit reached (max 200 items)" },
        { status: 400 }
      );
    }

    if (!(await itemExists(item_id, item_type))) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { rows } = await sql`
      INSERT INTO user_watchlist (user_id, item_id, item_type)
      VALUES (${session.userId}, ${item_id}, ${item_type})
      ON CONFLICT (user_id, item_id, item_type) DO NOTHING
      RETURNING id, item_id, item_type, created_at
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Item already in watchlist" },
        { status: 409 }
      );
    }

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[watchlist] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
