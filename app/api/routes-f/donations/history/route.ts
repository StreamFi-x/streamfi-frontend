import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/donations/history (#466)
 *
 * Returns the authenticated user's tip/donation history (sent and/or received),
 * with date-range filtering and keyset (created_at) cursor pagination.
 *
 * Query: ?direction=sent|received|all&limit=20&cursor=<ISO>&from=<ISO>&to=<ISO>
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}
  const userId = session.userId;

  const { searchParams } = new URL(req.url);

  const direction = (searchParams.get("direction") ?? "all").toLowerCase();
  if (!["sent", "received", "all"].includes(direction)) {
    return NextResponse.json(
      { error: "direction must be one of sent | received | all" },
      { status: 400 },
    );
  }

  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cursor = searchParams.get("cursor");
  for (const [name, value] of [["from", from], ["to", to], ["cursor", cursor]] as const) {
    if (value && Number.isNaN(Date.parse(value))) {
      return NextResponse.json({ error: `${name} must be an ISO timestamp` }, { status: 400 });
    }
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (direction === "sent") {
    conditions.push(`t.sender_id = $${i++}`);
    params.push(userId);
  } else if (direction === "received") {
    conditions.push(`t.recipient_id = $${i++}`);
    params.push(userId);
  } else {
    conditions.push(`(t.sender_id = $${i} OR t.recipient_id = $${i})`);
    i += 1;
    params.push(userId);
  }
  if (from) {
    conditions.push(`t.created_at >= $${i++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`t.created_at <= $${i++}`);
    params.push(to);
  }
  if (cursor) {
    conditions.push(`t.created_at < $${i++}`);
    params.push(cursor);
  }

  // Fetch one extra row to determine the next cursor.
  const queryText = `
    SELECT t.id,
           t.amount_usdc,
           t.message,
           t.tx_hash,
           t.created_at,
           s.username AS sender_username,
           r.username AS recipient_username
    FROM tips t
    LEFT JOIN users s ON s.id = t.sender_id
    LEFT JOIN users r ON r.id = t.recipient_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY t.created_at DESC
    LIMIT $${i}`;
  params.push(limit + 1);

  try {
    const { rows } = await sql.query(queryText, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? new Date(items[items.length - 1].created_at).toISOString()
        : null;

    return NextResponse.json({
      donations: items.map((row) => ({
        id: row.id,
        amount_usdc: row.amount_usdc,
        sender_username: row.sender_username,
        recipient_username: row.recipient_username,
        message: row.message ?? null,
        tx_hash: row.tx_hash ?? null,
        created_at: row.created_at,
      })),
      pagination: { limit, nextCursor, hasMore },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load donation history" },
      { status: 500 },
    );
  }
}
