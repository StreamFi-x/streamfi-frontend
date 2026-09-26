-- Report-brigading resistance for stream_reports (#1447).
--
-- Naive per-account rate limiting cannot stop a brigade: a coordinated
-- group is many distinct accounts, each individually under any reasonable
-- limit. This adds what a per-account limit alone cannot provide: a real
-- reporter identity to key per-account and coordination checks on, and a
-- priority field so a high-signal pattern routes to expedited human review
-- rather than auto-actioning anything.

ALTER TABLE stream_reports
  ADD COLUMN IF NOT EXISTS reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Distinguishes a report with no attributable account (reporter never
-- authenticated) from one where reporter_user_id is merely unknown for some
-- other reason; anonymous reports carry zero weight in the coordination
-- heuristics below, since an unauthenticated reporter cannot be correlated
-- with anything.
ALTER TABLE stream_reports
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE stream_reports
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stream_reports_priority_check'
  ) THEN
    ALTER TABLE stream_reports
      ADD CONSTRAINT stream_reports_priority_check
      CHECK (priority IN ('normal', 'expedited'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stream_reports_priority_idx
  ON stream_reports (priority, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS stream_reports_reporter_user_id_idx
  ON stream_reports (reporter_user_id, created_at DESC)
  WHERE reporter_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stream_reports_stream_id_created_at_idx
  ON stream_reports (stream_id, created_at DESC);

-- Records WHY a report (or its stream, at the moment of a later report) was
-- flagged, for admin visibility and to avoid re-deriving the same signal
-- twice. One row per (report, signal); a single report can carry several.
CREATE TABLE IF NOT EXISTS stream_report_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID        NOT NULL REFERENCES stream_reports(id) ON DELETE CASCADE,
  signal      TEXT        NOT NULL
              CHECK (signal IN (
                'volume_spike',
                'new_account',
                'no_platform_activity',
                'coordinated_accounts',
                'duplicate_of_recent'
              )),
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_report_flags_report_id_idx
  ON stream_report_flags (report_id);

