import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const voteSchema = z.object({
  option_index: z.number().int().min(0),
});

async function ensurePollsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_polls (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id        UUID        NOT NULL,
      creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question         TEXT        NOT NULL,
      options          JSONB       NOT NULL,
      duration_seconds INTEGER     NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
      ends_at          TIMESTAMPTZ NOT NULL,
      ended_early      BOOLEAN     NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stream_poll_votes (
      id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      poll_id      UUID    NOT NULL REFERENCES stream_polls(id) ON DELETE CASCADE,
      voter_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL,
      voted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (poll_id, voter_id)
    )
  `;
}

/** POST /api/routes-f/stream/polls/[id]/vote — viewer casts a vote */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  const bodyResult = await validateBody(req, voteSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { option_index } = bodyResult.data;

  try {
    await ensurePollsTables();

    const { rows: pollRows } = await sql`
      SELECT id, options, ends_at, ended_early
      FROM stream_polls
      WHERE id = ${id}
      LIMIT 1
    `;

    if (pollRows.length === 0) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const poll = pollRows[0];

    // Check poll is still active
    if (poll.ended_early || new Date(poll.ends_at) <= new Date()) {
      return NextResponse.json({ error: "Poll has ended" }, { status: 410 });
    }

    // Validate option_index is within bounds
    const options: string[] = Array.isArray(poll.options)
      ? poll.options
      : JSON.parse(poll.options);
    if (option_index < 0 || option_index >= options.length) {
      return NextResponse.json(
        { error: `option_index must be between 0 and ${options.length - 1}` },
        { status: 400 }
      );
    }

    // Insert vote — UNIQUE constraint handles duplicate prevention
    try {
      await sql`
        INSERT INTO stream_poll_votes (poll_id, voter_id, option_index)
        VALUES (${id}, ${session.userId}, ${option_index})
      `;
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        return NextResponse.json(
          { error: "You have already voted on this poll" },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json(
      { message: "Vote recorded", option_index },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f stream/polls/:id/vote POST]", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
