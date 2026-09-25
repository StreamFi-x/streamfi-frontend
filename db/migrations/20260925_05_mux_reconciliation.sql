-- Mux asset <-> stream_recordings consistency sweep (#1409).
--
-- stream_recordings is the only table that references Mux assets on this
-- branch (the "clips" pages are backed by it). A recording whose Mux asset is
-- confirmed missing is hidden by setting status = 'unavailable' (every public
-- read already filters on status = 'ready'); the row itself is preserved.
--
-- Idempotent: safe to run more than once.

ALTER TABLE stream_recordings ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS mux_drift_findings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                  TEXT        NOT NULL
                        CHECK (kind IN ('MUX_ASSET_WITHOUT_DB_ROW', 'DB_ROW_WITHOUT_MUX_ASSET')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'remediated', 'resolved', 'dismissed')),
  mux_asset_id          TEXT        NOT NULL,
  recording_id          UUID,
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
