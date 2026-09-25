import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureModerationReportListDependencies } from "./_lib/db";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const querySchema = z.object({
  channel: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { channel, limit } = queryResult.data;

  try {
    await ensureModerationReportListDependencies();

    const channelResult = await sql`
      SELECT id FROM users WHERE id = ${channel} LIMIT 1
    `;

    if (channelResult.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only the channel owner may view their own moderation queue.
    if (channel !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reportsResult = await sql<{
      id: string;
      target_type: string;
      target_id: string;
      reporter_id: string;
      reason: string;
      status: string;
      created_at: string;
    }>`
      SELECT id, target_type, target_id, reporter_id, reason, status, created_at
      FROM route_f_moderation_reports
      WHERE creator_id = ${channel}
        AND status = 'open'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      channel,
      reports: reportsResult.rows,
      total: reportsResult.rows.length,
    });
  } catch (error) {
    console.error("[routes-f/moderation-report-list] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
