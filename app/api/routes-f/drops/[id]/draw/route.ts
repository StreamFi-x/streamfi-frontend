import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

type Winner = {
  viewer_id: string;
  username: string | null;
  avatar: string | null;
};

function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive must be a positive integer");
  }

  const maxUint32 = 0x100000000;
  const threshold = maxUint32 - (maxUint32 % maxExclusive);

  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= threshold);

  return value % maxExclusive;
}

function pickWinners<T>(items: T[], count: number): T[] {
  const mutable = [...items];

  for (let i = mutable.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [mutable[i], mutable[j]] = [mutable[j], mutable[i]];
  }

  return mutable.slice(0, Math.max(0, count));
}

async function ensureDropTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_drops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward TEXT NOT NULL,
      eligible_viewers TEXT NOT NULL CHECK (eligible_viewers IN ('all', 'subscribers')),
      winner_count INTEGER NOT NULL CHECK (winner_count > 0),
      ends_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      winners JSONB,
      drawn_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stream_drop_entries (
      drop_id UUID NOT NULL REFERENCES stream_drops(id) ON DELETE CASCADE,
      viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (drop_id, viewer_id)
    )
  `;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureDropTables();

    await sql`BEGIN`;
    try {
      await sql`
        UPDATE stream_drops
        SET status = 'closed', updated_at = NOW()
        WHERE id = ${id}
          AND status = 'active'
          AND ends_at <= NOW()
      `;

      const { rows: dropRows } = await sql`
        SELECT id, creator_id, winner_count, winners, drawn_at, status
        FROM stream_drops
        WHERE id = ${id}
        LIMIT 1
      `;

      if (dropRows.length === 0) {
        await sql`ROLLBACK`;
        return NextResponse.json({ error: "Drop not found" }, { status: 404 });
      }

      const drop = dropRows[0];

      if (String(drop.creator_id) !== session.userId) {
        await sql`ROLLBACK`;
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (drop.drawn_at) {
        await sql`COMMIT`;
        return NextResponse.json({
          message: "Winners already drawn",
          winners: drop.winners ?? [],
          closed: true,
        });
      }

      const { rows: entryRows } = await sql<Winner>`
        SELECT e.viewer_id, u.username, u.avatar
        FROM stream_drop_entries e
        JOIN users u ON u.id = e.viewer_id
        WHERE e.drop_id = ${id}
        ORDER BY e.created_at ASC
      `;

      const winners = pickWinners(entryRows, Number(drop.winner_count ?? 0));

      await sql`
        UPDATE stream_drops
        SET
          winners = ${JSON.stringify(winners)}::jsonb,
          status = 'closed',
          drawn_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
      `;

      await sql`COMMIT`;

      return NextResponse.json({
        drop_id: id,
        winner_count: winners.length,
        winners,
        closed: true,
      });
    } catch (txError) {
      await sql`ROLLBACK`;
      throw txError;
    }
  } catch (error) {
    console.error("[routes-f drops/:id/draw POST]", error);
    return NextResponse.json(
      { error: "Failed to draw winners" },
      { status: 500 }
    );
  }
}
