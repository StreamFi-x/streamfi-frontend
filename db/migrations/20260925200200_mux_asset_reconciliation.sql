-- Mux asset <-> stream_recordings / stream_clips consistency sweep (#1409).
--
-- A row whose Mux asset is confirmed missing is hidden by setting
-- status = 'unavailable' (public reads filter on status = 'ready'); the row
-- itself is preserved. stream_clips.status has a CHECK constraint, which is
-- widened to allow 'unavailable'.
--
-- Idempotent. Tables that do not exist in an environment are skipped.

DO $$
BEGIN
  IF to_regclass('stream_recordings') IS NOT NULL THEN
    ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;
  END IF;
  IF to_regclass('stream_clips') IS NOT NULL THEN
    ALTER TABLE stream_clips ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;
    ALTER TABLE stream_clips DROP CONSTRAINT IF EXISTS stream_clips_status_check;
    -- Validated online by 20260925200400_data_integrity_online_steps.
    ALTER TABLE stream_clips
      ADD CONSTRAINT stream_clips_status_check
      CHECK (status IN ('processing', 'ready', 'failed', 'unavailable')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mux_drift_findings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                  TEXT        NOT NULL
                        CHECK (kind IN ('MUX_ASSET_WITHOUT_DB_ROW', 'DB_ROW_WITHOUT_MUX_ASSET')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'remediated', 'resolved', 'dismissed')),
  mux_asset_id          TEXT        NOT NULL,
  row_table             TEXT        CHECK (row_table IN ('stream_recordings', 'stream_clips')),
  row_id                UUID,
  playback_id           TEXT,
  user_id               UUID,
  mux_live_stream_id    TEXT,
  asset_created_at      TIMESTAMPTZ,
  first_detected_run_id UUID,
  last_detected_run_id  UUID,
  first_detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  detection_count       INTEGER     NOT NULL DEFAULT 1,
  previous_status       TEXT,
  remediation_action    TEXT,
  remediated_at         TIMESTAMPTZ,
  remediated_by         TEXT,
  resolved_at           TIMESTAMPTZ,
  notes                 TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mux_drift_findings_open
  ON mux_drift_findings (kind, mux_asset_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_mux_drift_findings_status
  ON mux_drift_findings (status, last_detected_at DESC);
