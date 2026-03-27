/**
 * GET /api/routes-f/conflicts
 *
 * Admin-only: list open username disputes.
 * Requires the caller to be an admin (checked via users.is_admin flag).
 *
 * Query params: limit (1-100, default 20), cursor (dispute id for pagination)
 *
 * Response:
 *   { "disputes": [...], "next_cursor": "uuid" | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { paginationSchema } from "@/app/api/routes-f/_lib/schemas";
import { ensureDisputesTable } from "./_lib/disputes";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth + admin check
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  const adminCheck = await sql`
    SELECT 1 FROM users WHERE id = ${session.userId} AND is_admin = TRUE LIMIT 1
  `;
  if (adminCheck.rows.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Validate query params
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, paginationSchema);
  if (queryResult instanceof Response) {return queryResult;}

  const { limit, cursor } = queryResult.data;

  // 3. Fetch disputes
  try {
    await ensureDisputesTable();

    const { rows } = cursor
      ? await sql`
          SELECT id, claimed_username, claimant_user_id, reason, status, created_at
          FROM username_disputes
          WHERE status = 'open' AND id > ${cursor}
          ORDER BY created_at ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, claimed_username, claimant_user_id, reason, status, created_at
          FROM username_disputes
          WHERE status = 'open'
          ORDER BY created_at ASC
          LIMIT ${limit}
        `;

    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return NextResponse.json({ disputes: rows, next_cursor: nextCursor });
  } catch (err) {
    console.error("[conflicts] DB error listing disputes:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
