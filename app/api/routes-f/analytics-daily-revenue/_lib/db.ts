import { sql } from "@vercel/postgres";

export async function ensureRevenueEventsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_revenue_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source VARCHAR(20) NOT NULL,
      amount NUMERIC(20, 7) NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT route_f_revenue_events_source_check
        CHECK (source IN ('tip', 'subscription')),
      CONSTRAINT route_f_revenue_events_amount_check
        CHECK (amount > 0)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_revenue_events_channel_time
      ON route_f_revenue_events (channel_id, occurred_at DESC)
  `;
}
