-- Add session invalidations table for #1385
-- Provides audit trail and invalidation event system for session revocation

CREATE TABLE IF NOT EXISTS session_invalidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    raw_token_hash VARCHAR(64), -- SHA-256 hash of the revoked token
    invalidated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('logout', 'security', 'admin', 'migration')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by user_id and token_hash
CREATE INDEX IF NOT EXISTS idx_session_invalidations_user_token ON session_invalidations(user_id, raw_token_hash) WHERE raw_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_invalidations_user_time ON session_invalidations(user_id, invalidated_at);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_session_invalidations_created_at ON session_invalidations(created_at);