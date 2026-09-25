import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureRevenueEventsSchema } from "./_lib/db";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

const querySchema = z.object({
  channel: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).default(DEFAULT_RANGE_DAYS),
});

const recordRevenueEventSchema = z.object({
  channel: z.string().uuid(),
  source: z.enum(["tip", "subscription"]),
  amount: z.coerce.number().positive(),
});

/**
 * GET returns daily tip + subscription revenue for a channel, aggregated
 * from route_f_revenue_events.
 *
 * NOTE: this repo does not yet persist a per-transaction ledger for tips
 * (totals are aggregated on-demand from Horizon in
 * app/api/tips/refresh-total) or for subscriptions (the `subscriptions`
 * table has no price column). route_f_revenue_events is a new, minimal
 * ledger scoped to this feature; nothing in the existing tip refresh or
 * subscription creation flow writes to it yet. See the POST handler below
 * for how entries are recorded, and the PR description for why wiring the
 * real payment flows into this table was left out of this change.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { channel, days } = queryResult.data;

  try {
    await ensureRevenueEventsSchema();

    const channelResult = await sql`
      SELECT id FROM users WHERE id = ${channel} LIMIT 1
    `;

    if (channelResult.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Only the channel owner may view their own revenue breakdown.
    if (channel !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dailyResult = await sql<{
      bucket: string;
      tip_revenue: string;
      subscription_revenue: string;
      total_revenue: string;
    }>`
      SELECT
        TO_CHAR(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(amount) FILTER (WHERE source = 'tip'), 0)::text AS tip_revenue,
        COALESCE(SUM(amount) FILTER (WHERE source = 'subscription'), 0)::text AS subscription_revenue,
        COALESCE(SUM(amount), 0)::text AS total_revenue
      FROM route_f_revenue_events
      WHERE channel_id = ${channel}
        AND occurred_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY date_trunc('day', occurred_at)
      ORDER BY date_trunc('day', occurred_at) ASC
    `;

    return NextResponse.json({
      channel,
      range_days: days,
      daily_revenue: dailyResult.rows,
    });
  } catch (error) {
    console.error("[routes-f/analytics-daily-revenue] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST records a single tip or subscription revenue event for a channel.
 * Intended to be called from the real payment/subscription flows once
 * they're wired up — kept separate from that (larger, payment-critical)
 * change here. See the GET handler's note above.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, recordRevenueEventSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { channel, source, amount } = bodyResult.data;

  if (channel !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await ensureRevenueEventsSchema();

    const { rows } = await sql`
      INSERT INTO route_f_revenue_events (channel_id, source, amount)
      VALUES (${channel}, ${source}, ${amount})
      RETURNING id, channel_id, source, amount, occurred_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f/analytics-daily-revenue] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
