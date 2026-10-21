-- Session replay / breadcrumb reconstructions for client-side wallet and
-- tipping errors (#1750). Written by POST /api/session-replay/submit and
-- reviewed by admins at /admin/replays.
CREATE TABLE IF NOT EXISTS session_replays (
  id            TEXT        PRIMARY KEY,
  flow          TEXT        NOT NULL, -- 'wallet' | 'tipping' | 'general'
  error_message TEXT        NOT NULL,
  error_stack   TEXT,
  error_details JSONB,
  breadcrumbs   JSONB       NOT NULL DEFAULT '[]'::JSONB,
  environment   JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_replays_flow_created_idx
  ON session_replays (flow, created_at DESC);
CREATE INDEX IF NOT EXISTS session_replays_created_at_idx
  ON session_replays (created_at DESC);
