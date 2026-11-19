-- Viewer heartbeat, for current_viewers reconciliation (#1403).
--
-- stream_viewers previously had only joined_at/left_at: a viewer who closes
-- the tab, loses connection, or crashes never calls the leave endpoint, so
-- their row (and the users.current_viewers counter it backs) never corrects
-- itself. heartbeat_at is touched periodically by the watch page while a
-- viewer is actually still on the page; a row whose heartbeat is older than
-- the reconciliation job's staleness window is treated as abandoned.
--
-- Backfilled from joined_at so existing open rows have a sane starting point
-- rather than NULL, which would otherwise make every one of them look
-- infinitely stale to the very first reconciliation run.

ALTER TABLE stream_viewers ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

UPDATE stream_viewers
   SET heartbeat_at = joined_at
 WHERE heartbeat_at IS NULL
   AND left_at IS NULL;

-- The reconciliation job scans open rows ordered by staleness; this keeps
-- that scan an index lookup rather than a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_stream_viewers_open_heartbeat
  ON stream_viewers (heartbeat_at)
  WHERE left_at IS NULL;
