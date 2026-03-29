import { sql } from "@vercel/postgres";

export async function ensurePollSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_polls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
      streamer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      duration_seconds INTEGER NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closes_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    ALTER TABLE stream_polls
    ADD COLUMN IF NOT EXISTS streamer_id UUID REFERENCES users(id) ON DELETE CASCADE
  `;

  await sql`
    ALTER TABLE stream_polls
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  `;

  await sql`
    ALTER TABLE stream_polls
    ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS poll_votes (
      poll_id UUID NOT NULL REFERENCES stream_polls(id) ON DELETE CASCADE,
      voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL,
      voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (poll_id, voter_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_polls_stream_created
    ON stream_polls (stream_id, created_at DESC)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_polls_one_active
    ON stream_polls (stream_id)
    WHERE status = 'active'
  `;
}

export async function closeExpiredPolls(): Promise<void> {
  await sql`
    UPDATE stream_polls
    SET status = 'closed'
    WHERE status = 'active'
      AND closes_at <= NOW()
  `;
}
