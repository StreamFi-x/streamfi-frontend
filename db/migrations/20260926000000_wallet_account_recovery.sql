-- 20260926000000_wallet_account_recovery.sql
-- Account recovery tables for non-custodial / wallet-only users (#1446)

CREATE TABLE IF NOT EXISTS user_recovery_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recovery_type VARCHAR(50) NOT NULL CHECK (recovery_type IN ('email', 'backup_key', 'passphrase_hash')),
    recovery_identifier TEXT NOT NULL,
    verification_code_hash VARCHAR(255),
    verification_code_expires_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recovery_type)
);

CREATE TABLE IF NOT EXISTS account_recovery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    new_wallet VARCHAR(56) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_recovery_methods_user ON user_recovery_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recovery_methods_identifier ON user_recovery_methods(recovery_identifier);
CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_token ON account_recovery_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_user ON account_recovery_requests(user_id);
