-- Dispute resolution system for on-chain tips
-- Allows viewers/creators to dispute tips with evidence collection and resolution tracking

CREATE TABLE IF NOT EXISTS tip_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id UUID NOT NULL, -- Reference to original tips table row
  tx_hash VARCHAR(255) NOT NULL, -- Original transaction hash for audit trail
  
  -- Who initiated the dispute
  plaintiff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaintiff_type VARCHAR(20) NOT NULL CHECK (plaintiff_type IN ('viewer', 'creator')),
  
  -- The parties involved in the original transaction
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Dispute metadata
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'unauthorized_transaction',
    'account_compromise',
    'coercion',
    'minor_access',
    'fraudulent_payment_method',
    'service_not_rendered',
    'other'
  )),
  amount_disputed NUMERIC(20, 7) NOT NULL,
  asset_disputed VARCHAR(10) NOT NULL DEFAULT 'XLM', -- e.g., 'XLM', 'USDC'
  description TEXT NOT NULL,
  
  -- Status workflow
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',           -- Dispute just filed
    'under_review',   -- Admin investigating
    'evidence_requested', -- Awaiting evidence from one party
    'resolved',       -- Final decision made
    'dismissed',      -- Rejected / closed
    'appealed'        -- Appealing a resolution
  )),
  
  -- Resolution details (once status = 'resolved')
  resolution_type VARCHAR(20) CHECK (resolution_type IN (
    'compensating_payment',  -- Platform issued refund via new transaction
    'creator_refund',        -- Creator voluntarily refunded
    'both_parties_agree',    -- Mutual settlement
    'platform_absorbs'       -- Platform ate the loss
  )),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id), -- Admin who resolved it
  resolution_notes TEXT,
  
  -- Compensating transaction (if resolution_type = 'compensating_payment')
  compensating_tx_hash VARCHAR(255),
  compensating_amount NUMERIC(20, 7),
  compensating_issued_at TIMESTAMPTZ,
  
  -- Abuse resistance: track dispute attempts to prevent rate-limit abuse
  previous_dispute_count INTEGER DEFAULT 0, -- Count of prior disputes by this plaintiff
  similar_disputes_in_window INTEGER DEFAULT 0, -- Count of disputes in last 30 days by this plaintiff
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Evidence collection: supporting documentation for disputes
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES tip_disputes(id) ON DELETE CASCADE,
  
  -- Who submitted the evidence
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Evidence type
  evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN (
    'screenshot',
    'email_correspondence',
    'transaction_history',
    'account_statement',
    'identity_verification',
    'chat_log',
    'other_documentation'
  )),
  
  description TEXT,
  
  -- File storage reference (URL or file hash - implementation dependent)
  file_url VARCHAR(500),
  file_hash VARCHAR(255), -- SHA-256 of file for integrity verification
  file_size_bytes INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Dispute comments/communication between parties and admins
CREATE TABLE IF NOT EXISTS dispute_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES tip_disputes(id) ON DELETE CASCADE,
  
  -- Who made the comment
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('plaintiff', 'defendant', 'admin')),
  
  -- Comment content
  content TEXT NOT NULL,
  is_visible_to_both_parties BOOLEAN DEFAULT TRUE, -- Internal notes if FALSE
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Appeal process: if either party disagrees with resolution
CREATE TABLE IF NOT EXISTS dispute_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_dispute_id UUID NOT NULL REFERENCES tip_disputes(id) ON DELETE CASCADE,
  
  -- Who is appealing
  appellant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Appeal reason
  reason TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied')),
  
  -- Resolution
  reviewed_by UUID REFERENCES users(id),
  appeal_resolution TEXT,
  resolved_at TIMESTAMPTZ,
  
  -- Creates a new dispute if accepted (linked via new_dispute_id)
  new_dispute_id UUID REFERENCES tip_disputes(id),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Dispute metrics for rate limiting and abuse detection
CREATE TABLE IF NOT EXISTS dispute_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Counters for abuse detection
  disputes_filed_lifetime INTEGER DEFAULT 0,
  disputes_filed_30d INTEGER DEFAULT 0,
  disputes_won_lifetime INTEGER DEFAULT 0,
  disputes_won_30d INTEGER DEFAULT 0,
  disputes_lost_lifetime INTEGER DEFAULT 0,
  disputes_lost_30d INTEGER DEFAULT 0,
  
  -- Risk flags
  is_flagged_for_abuse BOOLEAN DEFAULT FALSE,
  abuse_reason VARCHAR(255),
  flagged_at TIMESTAMPTZ,
  
  -- Last activity
  last_dispute_filed TIMESTAMPTZ,
  
  -- Audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for query efficiency
CREATE INDEX IF NOT EXISTS idx_tip_disputes_plaintiff ON tip_disputes(plaintiff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tip_disputes_sender ON tip_disputes(sender_id);
CREATE INDEX IF NOT EXISTS idx_tip_disputes_recipient ON tip_disputes(recipient_id);
CREATE INDEX IF NOT EXISTS idx_tip_disputes_status ON tip_disputes(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tip_disputes_tx_hash ON tip_disputes(tx_hash) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tip_disputes_created ON tip_disputes(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_comments_dispute ON dispute_comments(dispute_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dispute_appeals_original ON dispute_appeals(original_dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_appeals_appellant ON dispute_appeals(appellant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_metrics_abuse_flag ON dispute_metrics(is_flagged_for_abuse) WHERE is_flagged_for_abuse = TRUE;

-- Audit function to update updated_at on any dispute change
CREATE OR REPLACE FUNCTION update_dispute_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dispute_update_timestamp
  BEFORE UPDATE ON tip_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_dispute_updated_at();

-- Function to check if a user is rate-limited for filing disputes
CREATE OR REPLACE FUNCTION is_dispute_rate_limited(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  disputes_in_24h INTEGER;
  disputes_in_7d INTEGER;
BEGIN
  SELECT COUNT(*) INTO disputes_in_24h
  FROM tip_disputes
  WHERE plaintiff_id = user_id
    AND created_at > NOW() - INTERVAL '24 hours'
    AND deleted_at IS NULL;
  
  SELECT COUNT(*) INTO disputes_in_7d
  FROM tip_disputes
  WHERE plaintiff_id = user_id
    AND created_at > NOW() - INTERVAL '7 days'
    AND deleted_at IS NULL;
  
  -- Rate limit: max 3 disputes in 24h, max 10 in 7d
  RETURN disputes_in_24h >= 3 OR disputes_in_7d >= 10;
END;
$$ LANGUAGE plpgsql;

-- Function to detect potential abuse pattern: multiple disputes against same creator
CREATE OR REPLACE FUNCTION has_abuse_pattern_against_creator(plaintiff_id UUID, creator_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  dispute_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dispute_count
  FROM tip_disputes
  WHERE plaintiff_id = plaintiff_id
    AND recipient_id = creator_id
    AND created_at > NOW() - INTERVAL '30 days'
    AND deleted_at IS NULL;
  
  -- Flag if more than 5 disputes against same creator in 30d
  RETURN dispute_count > 5;
END;
$$ LANGUAGE plpgsql;
