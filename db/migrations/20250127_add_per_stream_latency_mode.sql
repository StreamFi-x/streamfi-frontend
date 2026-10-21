-- Add per-stream latency mode configuration
-- Allows creators to choose latency mode per stream, not just globally
-- Falls back to user's global preference if not set

ALTER TABLE stream_sessions
ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10);

-- Index for efficient queries on stream creation/lookup
CREATE INDEX IF NOT EXISTS idx_stream_sessions_latency_mode ON stream_sessions(latency_mode);
