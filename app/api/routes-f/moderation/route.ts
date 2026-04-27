import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

type ModItemType = "stream" | "chat_message" | "profile" | "clip" | "emote";

const VALID_TYPES: ModItemType[] = [
  "stream",
  "chat_message",
  "profile",
  "clip",
  "emote",
];

async function requireModOrAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = rows[0]?.role;
  if (role !== "admin" && role !== "moderator") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireModOrAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const searchParams = new URL(req.url).searchParams;
  const status = searchParams.get("status") ?? "pending";
  const type = searchParams.get("type");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "20"))
  );
  const offset = (page - 1) * limit;

  const statusFilter = status === "all" ? null : status;
  const typeFilter =
    type && VALID_TYPES.includes(type as ModItemType) ? type : null;

  const { rows } = await sql`
    SELECT
      id,
      item_type,
      item_id,
      reporter_id,
      reported_user_id,
      reason,
      details,
      auto_flagged,
      status,
      report_count,
      priority_score,
      assigned_to,
      action_taken,
      action_notes,
      created_at,
      actioned_at
    FROM moderation_queue
    WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
      AND (${typeFilter}::text IS NULL OR item_type = ${typeFilter})
    ORDER BY priority_score DESC, created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return NextResponse.json({ items: rows, page, limit });
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { rows: submitterRows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = submitterRows[0]?.role;
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    item_type?: ModItemType;
    item_id?: string;
    reporter_id?: string;
    reported_user_id?: string;
    reason?: string;
    details?: string;
    auto_flagged?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.item_type || !VALID_TYPES.includes(body.item_type)) {
    return NextResponse.json({ error: "Invalid item_type" }, { status: 400 });
  }
  if (!body.item_id || !body.reason) {
    return NextResponse.json(
      { error: "item_id and reason are required" },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    INSERT INTO moderation_queue (
      item_type,
      item_id,
      reporter_id,
      reported_user_id,
      reason,
      details,
      auto_flagged,
      status,
      report_count,
      priority_score
    )
    VALUES (
      ${body.item_type},
      ${body.item_id},
      ${body.reporter_id ?? null},
      ${body.reported_user_id ?? null},
      ${body.reason},
      ${body.details ?? null},
      ${body.auto_flagged ?? false},
      'pending',
      1,
      1
    )
    ON CONFLICT (item_type, item_id)
    WHERE status IN ('pending', 'under_review')
    DO UPDATE SET
      report_count = moderation_queue.report_count + 1,
      auto_flagged = moderation_queue.auto_flagged OR EXCLUDED.auto_flagged,
      details = COALESCE(EXCLUDED.details, moderation_queue.details),
      reason = moderation_queue.reason,
      priority_score = CASE
        WHEN moderation_queue.report_count + 1 >= 5 THEN 100
        ELSE moderation_queue.priority_score + 1
      END
    RETURNING *
  `;

  return NextResponse.json({ item: rows[0] }, { status: 201 });
}
