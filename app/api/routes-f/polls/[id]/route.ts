import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { closeExpiredPolls, ensurePollSchema } from "../_lib/db";

const updatePollSchema = z.object({
  question: z.string().trim().min(1).max(200).optional(),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6).optional(),
  duration_seconds: z.number().int().min(15).max(600).optional(),
  status: z.enum(["active", "closed"]).optional(),
});

async function getOwnedPoll(id: string, userId: string) {
  const { rows } = await sql<{
    id: string;
    streamer_id: string;
    options: Array<{ id: number; text: string }>;
    status: string;
  }>`
    SELECT id, streamer_id, options, status
    FROM stream_polls
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      error: NextResponse.json({ error: "Poll not found" }, { status: 404 }),
    };
  }

  if (rows[0].streamer_id !== userId) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { poll: rows[0] };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updatePollSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensurePollSchema();
    await closeExpiredPolls();

    const { id } = await params;
    const owned = await getOwnedPoll(id, session.userId);
    if (owned.error) {
      return owned.error;
    }

    const existing = owned.poll!;
    const nextOptions = bodyResult.data.options
      ? bodyResult.data.options.map((text, index) => ({ id: index + 1, text }))
      : existing.options;
    const nextStatus = bodyResult.data.status ?? existing.status;
    const closesAt = bodyResult.data.duration_seconds
      ? new Date(
          Date.now() + bodyResult.data.duration_seconds * 1000
        ).toISOString()
      : null;

    await sql`
      UPDATE stream_polls
      SET
        question = COALESCE(${bodyResult.data.question ?? null}, question),
        options = ${JSON.stringify(nextOptions)}::jsonb,
        duration_seconds = COALESCE(${bodyResult.data.duration_seconds ?? null}, duration_seconds),
        status = ${nextStatus},
        closes_at = COALESCE(${closesAt}, closes_at)
      WHERE id = ${id}
    `;

    return NextResponse.json({ id, status: nextStatus });
  } catch (error) {
    console.error("[routes-f polls/:id PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update poll" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensurePollSchema();

    const { id } = await params;
    const owned = await getOwnedPoll(id, session.userId);
    if (owned.error) {
      return owned.error;
    }

    await sql`
      DELETE FROM stream_polls
      WHERE id = ${id}
    `;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[routes-f polls/:id DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete poll" },
      { status: 500 }
    );
  }
}
