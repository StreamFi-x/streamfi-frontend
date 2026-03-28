import { sql } from "@vercel/postgres";

/**
 * Ensures all necessary tables for routes-f features exist.
 */
export async function ensureRoutesFSchema(): Promise<void> {
  // 1. Subscriptions Table
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status     VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      UNIQUE(user_id, creator_id, status)
    )
  `;

  // 2. VOD Comments Table
  await sql`
    CREATE TABLE IF NOT EXISTS vod_comments (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recording_id      VARCHAR(255) NOT NULL, -- Mux playback ID or asset ID
      timestamp_seconds FLOAT       NOT NULL,
      body              TEXT        NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // 3. Announcements Table
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body       VARCHAR(500) NOT NULL,
      pinned     BOOLEAN     NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // 4. Ensure indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vod_comments_recording ON vod_comments(recording_id, timestamp_seconds)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_announcements_creator ON announcements(creator_id, created_at DESC)`;

  // 5. Accessibility Settings Table
  await sql`
    CREATE TABLE IF NOT EXISTS accessibility_settings (
      user_id             UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      captions_enabled    BOOLEAN     NOT NULL DEFAULT true,
      caption_font_size   VARCHAR(10) NOT NULL DEFAULT 'medium',
      high_contrast      BOOLEAN     NOT NULL DEFAULT false,
      reduce_motion       BOOLEAN     NOT NULL DEFAULT false,
      screen_reader_hints BOOLEAN     NOT NULL DEFAULT true,
      autoplay            BOOLEAN     NOT NULL DEFAULT false,
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Add is_featured to users if it doesn't exist
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false
  `;
}
