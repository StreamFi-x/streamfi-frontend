import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const MAX_SCHEDULED_RERUNS = 3;

const scheduleRerunSchema = z.object({
  recording_id: z.string().min(1).max(255),
  scheduled_at: z.string().datetime({ message: "scheduled_at must be an ISO 8601 datetime" }),
  notify_followers: z.boolean().default(false),
});

async function ensureRerunsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_reruns (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recording_id     VARCHAR(255) NOT NULL,
      scheduled_at     TIMESTAMPTZ NOT NULL,
      notify_followers BOOLEAN     NOT NULL DEFAULT false,
      notified         BOOLEAN     NOT NULL DEFAULT false,
      cancelled        BOOLEAN     NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_reruns_creator
    ON stream_reruns (creator_id, scheduled_at ASC)
    WHERE cancelled = false
  `;
}

/** GET /api/routes-f/stream/rerun — list scheduled reruns for authenticated creator */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    await ensureRerunsTable();

    const { rows } = await sql`
      SELECT id, recording_id, scheduled_at, notify_followers, notified, created_at
      FROM stream_reruns
      WHERE creator_id = ${session.userId}
        AND cancelled = false
      ORDER BY scheduled_at ASC
    `;

    return NextResponse.json({ reruns: rows });
  } catch (error) {
    console.error("[routes-f stream/rerun GET]", error);
    return NextResponse.json({ error: "Failed to fetch reruns" }, { status: 500 });
  }
}

/** POST /api/routes-f/stream/rerun — schedule a rerun */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const bodyResult = await validateBody(req, scheduleRerunSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const { recording_id, scheduled_at, notify_followers } = bodyResult.data;

  // Validate scheduled_at is in the future
  const scheduledDate = new Date(scheduled_at);
  if (scheduledDate <= new Date()) {
    return NextResponse.json(
      { error: "scheduled_at must be in the future" },
      { status: 400 }
    );
  }

  try {
    await ensureRerunsTable();

    // Enforce max 3 active reruns
    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS total
      FROM stream_reruns
      WHERE creator_id = ${session.userId}
        AND cancelled = false
        AND scheduled_at > now()
    `;

    const count = Number(countRows[0]?.total ?? 0);
    if (count >= MAX_SCHEDULED_RERUNS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_SCHEDULED_RERUNS} scheduled reruns allowed at once` },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO stream_reruns (creator_id, recording_id, scheduled_at, notify_followers)
      VALUES (${session.userId}, ${recording_id}, ${scheduled_at}, ${notify_followers})
      RETURNING id, recording_id, scheduled_at, notify_followers, notified, created_at
    `;

    const rerun = rows[0];

    // Queue notification job if requested
    if (notify_followers) {
      await sql`
        INSERT INTO notification_jobs (type, payload, created_at)
        VALUES (
          'rerun_scheduled',
          ${JSON.stringify({ rerun_id: rerun.id, creator_id: session.userId, scheduled_at })}::jsonb,
          now()
        )
      `.catch(() => {
        // notification_jobs table may not exist yet — non-fatal
        console.warn("[routes-f stream/rerun] Could not queue notification job");
      });
    }

    return NextResponse.json(rerun, { status: 201 });
  } catch (error) {
    console.error("[routes-f stream/rerun POST]", error);
    return NextResponse.json({ error: "Failed to schedule rerun" }, { status: 500 });
  }
}
