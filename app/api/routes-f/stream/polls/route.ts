import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const MAX_DURATION_SECONDS = 300;

const pollsQuerySchema = z.object({
  stream_id: z.string().uuid(),
});

const createPollSchema = z.object({
  stream_id: z.string().uuid(),
  question: z.string().trim().min(1).max(200),
  options: z
    .array(z.string().trim().min(1).max(60))
    .min(2, "At least 2 options required")
    .max(4, "At most 4 options allowed"),
  duration_seconds: z.number().int().min(1).max(MAX_DURATION_SECONDS),
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
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_polls_stream
    ON stream_polls (stream_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_poll_votes_poll
    ON stream_poll_votes (poll_id, option_index)
  `;
}

function isPollActive(poll: { ends_at: string; ended_early: boolean }): boolean {
  return !poll.ended_early && new Date(poll.ends_at) > new Date();
}

/** GET /api/routes-f/stream/polls?stream_id= — list active and recent polls (public) */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(new URL(req.url).searchParams, pollsQuerySchema);
  if (queryResult instanceof Response) return queryResult;

  const { stream_id } = queryResult.data;

  try {
    await ensurePollsTables();

    const { rows: polls } = await sql`
      SELECT
        p.id,
        p.stream_id,
        p.creator_id,
        p.question,
        p.options,
        p.duration_seconds,
        p.ends_at,
        p.ended_early,
        p.created_at,
        COALESCE(
          json_agg(
            json_build_object('option_index', v.option_index, 'count', v.cnt)
          ) FILTER (WHERE v.option_index IS NOT NULL),
          '[]'
        ) AS vote_counts
      FROM stream_polls p
      LEFT JOIN (
        SELECT poll_id, option_index, COUNT(*)::int AS cnt
        FROM stream_poll_votes
        GROUP BY poll_id, option_index
      ) v ON v.poll_id = p.id
      WHERE p.stream_id = ${stream_id}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ polls });
  } catch (error) {
    console.error("[routes-f stream/polls GET]", error);
    return NextResponse.json({ error: "Failed to fetch polls" }, { status: 500 });
  }
}

/** POST /api/routes-f/stream/polls — creator creates a poll */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, createPollSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { stream_id, question, options, duration_seconds } = bodyResult.data;

  try {
    await ensurePollsTables();

    const ends_at = new Date(Date.now() + duration_seconds * 1000).toISOString();

    const { rows } = await sql`
      INSERT INTO stream_polls (stream_id, creator_id, question, options, duration_seconds, ends_at)
      VALUES (
        ${stream_id},
        ${session.userId},
        ${question},
        ${JSON.stringify(options)}::jsonb,
        ${duration_seconds},
        ${ends_at}
      )
      RETURNING id, stream_id, creator_id, question, options, duration_seconds, ends_at, created_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f stream/polls POST]", error);
    return NextResponse.json({ error: "Failed to create poll" }, { status: 500 });
  }
}
