-- Tip-goal escrow tables for stream goals
-- Supports goal-based funding with per-contributor tracking and refund logic

CREATE TABLE IF NOT EXISTS tip_goals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stream_id               UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  
  title                   VARCHAR(255) NOT NULL,
  description             TEXT,
  goal_amount_xlm         NUMERIC(20, 7) NOT NULL,
  current_amount_xlm      NUMERIC(20, 7) DEFAULT 0,
  current_contributor_count INTEGER DEFAULT 0,
  
  -- Escrow account public key (used for all tips)
  escrow_account_public_key VARCHAR(255) NOT NULL,
  
  -- Timeline
  created_at              TIMESTAMPTZ DEFAULT now(),
  expires_at              TIMESTAMPTZ NOT NULL,
  
  -- State machine: DRAFT -> ACTIVE -> GOAL_REACHED -> RELEASING_FUNDS -> RELEASED
  --            or: ACTIVE -> DEADLINE_PASSED -> REFUNDING -> REFUND_COMPLETE
  status                  VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'ACTIVE', 'GOAL_REACHED', 'RELEASING_FUNDS', 'RELEASED',
    'DEADLINE_PASSED', 'REFUNDING', 'REFUND_COMPLETE'
  )),
  
  -- Completion tracking
  goal_reached_at         TIMESTAMPTZ,
  release_completed_at    TIMESTAMPTZ,
  refund_completed_at     TIMESTAMPTZ,
  
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tip_goals_creator
  ON tip_goals(creator_id);

CREATE INDEX IF NOT EXISTS idx_tip_goals_stream
  ON tip_goals(stream_id);

CREATE INDEX IF NOT EXISTS idx_tip_goals_expires
  ON tip_goals(expires_at) WHERE status IN ('ACTIVE', 'GOAL_REACHED');

CREATE INDEX IF NOT EXISTS idx_tip_goals_status
  ON tip_goals(status, updated_at DESC);

-- Per-contributor tracking for refunds
CREATE TABLE IF NOT EXISTS tip_goal_contributions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id                 UUID NOT NULL REFERENCES tip_goals(id) ON DELETE RESTRICT,
  contributor_wallet      VARCHAR(255) NOT NULL,
  contributor_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_xlm              NUMERIC(20, 7) NOT NULL,
  tx_hash                 VARCHAR(255) NOT NULL UNIQUE,
  
  -- Refund tracking
  refunded                BOOLEAN DEFAULT FALSE,
  refund_tx_hash          VARCHAR(255) UNIQUE,
  refund_attempted_at     TIMESTAMPTZ,
  refund_attempt_count    INTEGER DEFAULT 0,
  refund_failed_reason    VARCHAR(100), -- 'unreachable_account', 'transient_failure', 'max_retries_exceeded'
  refund_next_retry_at    TIMESTAMPTZ,
  
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_goal
  ON tip_goal_contributions(goal_id);

CREATE INDEX IF NOT EXISTS idx_contributions_wallet
  ON tip_goal_contributions(contributor_wallet);

-- Index for finding pending refunds
CREATE INDEX IF NOT EXISTS idx_contributions_pending_refund
  ON tip_goal_contributions(goal_id, refund_next_retry_at)
  WHERE refunded = FALSE AND tx_hash IS NOT NULL;

-- Index for unreachable/failed refunds that may need manual intervention
CREATE INDEX IF NOT EXISTS idx_contributions_unreachable
  ON tip_goal_contributions(goal_id)
  WHERE refund_failed_reason = 'unreachable_account';
