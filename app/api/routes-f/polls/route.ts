import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { getOptionalSession } from "@/app/api/routes-f/_lib/session";
import { closeExpiredPolls, ensurePollSchema } from "./_lib/db";

const pollQuerySchema = z.object({
  stream_id: uuidSchema,
});

const createPollSchema = z.object({
  stream_id: uuidSchema,
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  duration_seconds: z.number().int().min(15).max(600).default(60),
});

async function buildPollResponse(pollId: string, viewerId?: string | null) {
  const { rows: pollRows } = await sql<{
    id: string;
    question: string;
    options: Array<{ id: number; text: string }>;
    status: string;
    closes_at: string;
    viewer_voted: number | null;
  }>`
    SELECT
      p.id,
      p.question,
      p.options,
      p.status,
      p.closes_at,
      (
        SELECT pv.option_id
        FROM poll_votes pv
        WHERE pv.poll_id = p.id
          AND pv.voter_id = ${viewerId ?? null}
        LIMIT 1
      ) AS viewer_voted
    FROM stream_polls p
    WHERE p.id = ${pollId}
    LIMIT 1
  `;

  if (pollRows.length === 0) {
    return null;
  }

  const poll = pollRows[0];
  const { rows: voteRows } = await sql<{ option_id: number; votes: number }>`
    SELECT option_id, COUNT(*)::int AS votes
    FROM poll_votes
    WHERE poll_id = ${pollId}
    GROUP BY option_id
  `;

  const totalVotes = voteRows.reduce((sum, row) => sum + Number(row.votes), 0);
  const voteMap = new Map(
    voteRows.map(row => [Number(row.option_id), Number(row.votes)])
  );
  const options = (poll.options ?? []).map(option => {
    const votes = voteMap.get(option.id) ?? 0;
    const percentage =
      totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    return { ...option, votes, percentage };
  });

  return {
    id: poll.id,
    question: poll.question,
    options,
    status:
      poll.status === "active" && new Date(poll.closes_at) <= new Date()
        ? "closed"
        : poll.status,
    closes_at: poll.closes_at,
    viewer_voted: poll.viewer_voted ?? null,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = validateQuery(
    new URL(req.url).searchParams,
    pollQuerySchema
  );
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensurePollSchema();
    await closeExpiredPolls();

    const session = await getOptionalSession(req);
    const { rows } = await sql<{ id: string }>`
      SELECT id
      FROM stream_polls
      WHERE stream_id = ${queryResult.data.stream_id}
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ poll: null });
    }

    const poll = await buildPollResponse(rows[0].id, session?.userId ?? null);
    return NextResponse.json(poll);
  } catch (error) {
    console.error("[routes-f polls GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch poll" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createPollSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { stream_id, question, options } = bodyResult.data;
  const durationSeconds = bodyResult.data.duration_seconds ?? 60;

  try {
    await ensurePollSchema();
    await closeExpiredPolls();

    const { rows: streamRows } = await sql<{ user_id: string }>`
      SELECT user_id
      FROM stream_sessions
      WHERE id = ${stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (streamRows[0].user_id !== session.userId) {
      return NextResponse.json(
        { error: "Only the stream owner can create polls" },
        { status: 403 }
      );
    }

    const closesAt = new Date(
      Date.now() + durationSeconds * 1000
    ).toISOString();
    const normalizedOptions = options.map((text, index) => ({
      id: index + 1,
      text,
    }));

    try {
      const { rows } = await sql<{ id: string }>`
        INSERT INTO stream_polls (
          stream_id,
          streamer_id,
          question,
          options,
          status,
          duration_seconds,
          closes_at
        )
        VALUES (
          ${stream_id},
          ${session.userId},
          ${question},
          ${JSON.stringify(normalizedOptions)}::jsonb,
          'active',
          ${durationSeconds},
          ${closesAt}
        )
        RETURNING id
      `;

      const poll = await buildPollResponse(rows[0].id, session.userId);
      return NextResponse.json(poll, { status: 201 });
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        return NextResponse.json(
          { error: "Only one active poll is allowed per stream" },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[routes-f polls POST]", error);
    return NextResponse.json(
      { error: "Failed to create poll" },
      { status: 500 }
    );
  }
}
