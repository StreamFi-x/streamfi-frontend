import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { closeExpiredPolls, ensurePollSchema } from "../../_lib/db";

const voteSchema = z.object({
  option_id: z.number().int().min(1),
});

async function buildVoteResponse(pollId: string, viewerId: string) {
  const { rows: pollRows } = await sql<{
    id: string;
    question: string;
    options: Array<{ id: number; text: string }>;
    status: string;
    closes_at: string;
  }>`
    SELECT id, question, options, status, closes_at
    FROM stream_polls
    WHERE id = ${pollId}
    LIMIT 1
  `;

  if (pollRows.length === 0) {
    return null;
  }

  const { rows: voteRows } = await sql<{ option_id: number; votes: number }>`
    SELECT option_id, COUNT(*)::int AS votes
    FROM poll_votes
    WHERE poll_id = ${pollId}
    GROUP BY option_id
  `;

  const { rows: viewerRows } = await sql<{ option_id: number }>`
    SELECT option_id
    FROM poll_votes
    WHERE poll_id = ${pollId}
      AND voter_id = ${viewerId}
    LIMIT 1
  `;

  const totalVotes = voteRows.reduce((sum, row) => sum + Number(row.votes), 0);
  const voteMap = new Map(
    voteRows.map(row => [Number(row.option_id), Number(row.votes)])
  );

  return {
    id: pollRows[0].id,
    question: pollRows[0].question,
    options: (pollRows[0].options ?? []).map(option => {
      const votes = voteMap.get(option.id) ?? 0;
      return {
        ...option,
        votes,
        percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
      };
    }),
    status: pollRows[0].status,
    closes_at: pollRows[0].closes_at,
    viewer_voted: viewerRows[0]?.option_id ?? null,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, voteSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensurePollSchema();
    await closeExpiredPolls();

    const { id } = await params;
    const { rows: pollRows } = await sql<{
      id: string;
      options: Array<{ id: number; text: string }>;
      status: string;
      closes_at: string;
    }>`
      SELECT id, options, status, closes_at
      FROM stream_polls
      WHERE id = ${id}
      LIMIT 1
    `;

    if (pollRows.length === 0) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const poll = pollRows[0];
    if (poll.status !== "active" || new Date(poll.closes_at) <= new Date()) {
      return NextResponse.json({ error: "Poll has closed" }, { status: 410 });
    }

    const validOptionIds = new Set(
      (poll.options ?? []).map(option => option.id)
    );
    if (!validOptionIds.has(bodyResult.data.option_id)) {
      return NextResponse.json({ error: "Invalid option_id" }, { status: 400 });
    }

    await sql`
      INSERT INTO poll_votes (poll_id, voter_id, option_id)
      VALUES (${id}, ${session.userId}, ${bodyResult.data.option_id})
      ON CONFLICT (poll_id, voter_id)
      DO UPDATE SET
        option_id = EXCLUDED.option_id,
        voted_at = NOW()
    `;

    const payload = await buildVoteResponse(id, session.userId);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[routes-f polls/:id/vote POST]", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
