import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

const EXPORT_TYPES = [
  "earnings",
  "streams",
  "followers",
  "tips",
  "full",
] as const;
const EXPORT_FORMATS = ["csv", "json"] as const;
const MAX_EXPORTS_PER_DAY = 3;

async function ensureExportTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS export_jobs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID REFERENCES users(id),
      type         TEXT NOT NULL,
      format       TEXT NOT NULL,
      status       TEXT DEFAULT 'queued',
      file_url     TEXT,
      error        TEXT,
      created_at   TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `;
}

const createExportSchema = z.object({
  type: z.enum(EXPORT_TYPES),
  format: z.enum(EXPORT_FORMATS),
  from: z.string().optional(),
  to: z.string().optional(),
});

const pollSchema = z.object({
  job_id: z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const result = await validateBody(req, createExportSchema);
  if (result instanceof NextResponse) {
    return result;
  }
  const { type, format, from, to } = result.data;

  await ensureExportTable();

  // Rate limit: max 3 exports per user per day
  const { rows: countRows } = await sql`
    SELECT COUNT(*) AS count
    FROM export_jobs
    WHERE user_id = ${session.userId}
      AND created_at >= NOW() - INTERVAL '24 hours'
  `;
  if (Number(countRows[0]?.count ?? 0) >= MAX_EXPORTS_PER_DAY) {
    return NextResponse.json(
      { error: "Export rate limit reached. Maximum 3 exports per 24 hours." },
      { status: 429 }
    );
  }

  const { rows } = await sql`
    INSERT INTO export_jobs (user_id, type, format, status)
    VALUES (${session.userId}, ${type}, ${format}, 'queued')
    RETURNING id, status, created_at
  `;

  const job = rows[0];

  // Fire background processing (non-blocking stub — real worker handles this)
  processExportJob(job.id, session.userId, type, format, from, to).catch(
    () => {}
  );

  return NextResponse.json(
    { job_id: job.id, status: job.status },
    { status: 202 }
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const result = validateQuery(new URL(req.url).searchParams, pollSchema);
  if (result instanceof NextResponse) {
    return result;
  }
  const { job_id } = result.data;

  await ensureExportTable();

  const { rows } = await sql`
    SELECT id, type, format, status, file_url, error, created_at, completed_at
    FROM export_jobs
    WHERE id = ${job_id} AND user_id = ${session.userId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = rows[0];
  return NextResponse.json({
    job_id: job.id,
    type: job.type,
    format: job.format,
    status: job.status,
    download_url: job.file_url ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    completed_at: job.completed_at ?? null,
  });
}

/**
 * Background export processor stub. In production this runs as a queue worker
 * (e.g. Vercel Cron / BullMQ). Builds the file, uploads to R2/S3, then
 * updates the job record with a signed URL that expires in 1 hour.
 */
async function processExportJob(
  jobId: string,
  userId: string,
  type: (typeof EXPORT_TYPES)[number],
  format: (typeof EXPORT_FORMATS)[number],
  from?: string,
  to?: string
) {
  try {
    await sql`
      UPDATE export_jobs SET status = 'processing' WHERE id = ${jobId}
    `;

    const fromDate = from ? new Date(from) : new Date("2000-01-01");
    const toDate = to ? new Date(to) : new Date();

    let data: unknown[];

    if (type === "earnings" || type === "full") {
      const { rows } = await sql`
        SELECT t.created_at AS date, u.username AS sender, t.amount, t.asset, t.tx_hash
        FROM tips t
        LEFT JOIN users u ON u.id = t.sender_id
        WHERE t.recipient_id = ${userId}
          AND t.created_at BETWEEN ${fromDate.toISOString()} AND ${toDate.toISOString()}
        ORDER BY t.created_at DESC
      `;
      data = rows;
    } else if (type === "streams") {
      const { rows } = await sql`
        SELECT title, started_at AS date, ended_at, peak_viewers, total_views
        FROM stream_sessions
        WHERE creator_id = ${userId}
          AND started_at BETWEEN ${fromDate.toISOString()} AND ${toDate.toISOString()}
        ORDER BY started_at DESC
      `;
      data = rows;
    } else if (type === "followers") {
      const { rows } = await sql`
        SELECT u.username, f.created_at AS followed_at
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.creator_id = ${userId}
          AND f.created_at BETWEEN ${fromDate.toISOString()} AND ${toDate.toISOString()}
        ORDER BY f.created_at DESC
      `;
      data = rows;
    } else if (type === "tips") {
      const { rows } = await sql`
        SELECT t.created_at AS date, u.username AS recipient, t.amount, t.asset, t.tx_hash
        FROM tips t
        LEFT JOIN users u ON u.id = t.recipient_id
        WHERE t.sender_id = ${userId}
          AND t.created_at BETWEEN ${fromDate.toISOString()} AND ${toDate.toISOString()}
        ORDER BY t.created_at DESC
      `;
      data = rows;
    } else {
      data = [];
    }

    // Produce serialized output (real impl uploads to R2/S3 and returns signed URL)
    const serialized =
      format === "json"
        ? JSON.stringify(data, null, 2)
        : toCsv(data as Record<string, unknown>[]);

    // Placeholder: in production, upload `serialized` to object storage and store
    // the signed URL. Here we store a data URI so the job reaches "ready" status.
    const fileUrl =
      `data:${format === "json" ? "application/json" : "text/csv"};base64,` +
      Buffer.from(serialized).toString("base64");

    await sql`
      UPDATE export_jobs
      SET status = 'ready', file_url = ${fileUrl}, completed_at = NOW()
      WHERE id = ${jobId}
    `;
  } catch (err) {
    await sql`
      UPDATE export_jobs
      SET status = 'failed', error = ${String(err)}, completed_at = NOW()
      WHERE id = ${jobId}
    `.catch(() => {});
  }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h];
          if (val === null || val === undefined) {
            return "";
          }
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}
