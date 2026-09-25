/**
 * GET /api/routes-f/analytics-top-tippers (#1494)
 *
 * Returns the top tippers by total amount over the given range, for the
 * requesting channel owner's own stream. Reads from `tip_transactions`.
 * An anonymous/deleted-account tip (supporter_id IS NULL, per the
 * ON DELETE SET NULL foreign key) is grouped separately rather than
 * dropped, so the total isn't silently understated.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readFromReplica,
  ReplicaUnavailableError,
  replicaUnavailableResponse,
} from "@/lib/db/replica";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const querySchema = z.object({
  channel: z.string().uuid(),
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RANGE_DAYS)
    .default(DEFAULT_RANGE_DAYS),
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

  const { channel, days, limit } = queryResult.data;

  try {
    const result = await readFromReplica(
      "routes-f.analytics-top-tippers",
      async db => {
        const channelResult = await db`
          SELECT id FROM users WHERE id = ${channel} LIMIT 1
        `;

        if (channelResult.rows.length === 0) {
          return { status: 404 as const };
        }

        // Only the channel owner may view their own top-tippers breakdown.
        if (channel !== session.userId) {
          return { status: 403 as const };
        }

        const tippersResult = await db<{
          supporter_id: string | null;
          username: string | null;
          total_amount_xlm: string;
          tip_count: number;
        }>`
          SELECT
            t.supporter_id AS supporter_id,
            u.username AS username,
            SUM(t.amount_xlm)::text AS total_amount_xlm,
            COUNT(*)::int AS tip_count
          FROM tip_transactions t
          LEFT JOIN users u ON u.id = t.supporter_id
          WHERE t.creator_id = ${channel}
            AND t.created_at >= NOW() - (${days}::text || ' days')::interval
          GROUP BY t.supporter_id, u.username
          ORDER BY SUM(t.amount_xlm) DESC
          LIMIT ${limit}
        `;
        return { status: 200 as const, rows: tippersResult.rows };
      },
      { request: req }
    );

    if (result.status === 404) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (result.status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      channel,
      range_days: days,
      top_tippers: result.rows.map((row, index) => ({
        rank: index + 1,
        supporter_id: row.supporter_id,
        username:
          row.supporter_id === null ? null : (row.username ?? "Unknown"),
        anonymous: row.supporter_id === null,
        total_amount_xlm: row.total_amount_xlm,
        tip_count: row.tip_count,
      })),
    });
  } catch (error) {
    if (error instanceof ReplicaUnavailableError) {
      return replicaUnavailableResponse();
    }
    console.error("[routes-f/analytics-top-tippers] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
