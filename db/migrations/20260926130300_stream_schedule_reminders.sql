-- Stream scheduling with viewer reminders (#1428).
--
-- stream_schedule (from 20260327_routes_f_creator_finance_and_badges.sql) is
-- extended rather than replaced. scheduled_at stays the canonical start
-- instant; timezone records the creator's IANA zone so the wall-clock time and
-- weekly repeats are computed in that zone.
--
-- Reminders get a new table: stream_reminders exists in two incompatible
-- shapes (the legacy migration and a CREATE TABLE inside
-- app/api/routes-f/viewer/reminders), so it cannot be extended safely.

CREATE TABLE IF NOT EXISTS stream_schedule (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  category      TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_mins INT         NOT NULL DEFAULT 120,
  status        TEXT        NOT NULL DEFAULT 'upcoming',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none';
-- Occurrences created together by a weekly repeat share a series_id.
ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS series_id UUID;
-- Bumped whenever the start time changes; a reminder is delivered at most
-- once per version.
ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS went_live_at TIMESTAMPTZ;
ALTER TABLE stream_schedule ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stream_schedule_status_check'
  ) THEN
    -- NOT VALID: enforced for new writes without rejecting legacy rows.
    ALTER TABLE stream_schedule ADD CONSTRAINT stream_schedule_status_check
      CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled', 'missed')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stream_schedule_recurrence_check'
  ) THEN
    ALTER TABLE stream_schedule ADD CONSTRAINT stream_schedule_recurrence_check
      CHECK (recurrence IN ('none', 'weekly'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stream_schedule_creator_status
  ON stream_schedule (creator_id, status, scheduled_at);

CREATE TABLE IF NOT EXISTS stream_schedule_reminders (
  schedule_id       UUID        NOT NULL REFERENCES stream_schedule(id) ON DELETE CASCADE,
  viewer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opted_in          BOOLEAN     NOT NULL DEFAULT true,
  -- stream_schedule.version the reminder was delivered for.
  delivered_version INT,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_reminders_pending
  ON stream_schedule_reminders (schedule_id)
  WHERE opted_in;
CREATE INDEX IF NOT EXISTS idx_schedule_reminders_viewer
  ON stream_schedule_reminders (viewer_id);
