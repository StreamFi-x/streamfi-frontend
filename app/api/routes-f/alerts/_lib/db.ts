import { sql } from "@vercel/postgres";

export const ALERT_TYPES = [
  "tip",
  "subscription",
  "gift",
  "raid",
  "follow",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const DEFAULT_ALERT_CONFIG = {
  enabled_types: [...ALERT_TYPES],
  display_duration_ms: 5000,
  sound_enabled: true,
  custom_message_template: null as string | null,
};

export async function ensureAlertSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_alert_configs (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled_types TEXT[] NOT NULL DEFAULT ARRAY['tip', 'subscription', 'gift', 'raid', 'follow']::TEXT[],
      display_duration_ms INT NOT NULL DEFAULT 5000,
      sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      custom_message_template TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_alert_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_test BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_alert_events_user_created
      ON route_f_alert_events (user_id, created_at DESC)
  `;
}
