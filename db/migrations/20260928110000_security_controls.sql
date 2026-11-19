ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stream_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS stream_password_attempts (
  stream_session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_allowed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_session_id, ip_hash)
);
CREATE INDEX IF NOT EXISTS stream_password_attempts_expiry
  ON stream_password_attempts (updated_at);

CREATE OR REPLACE FUNCTION clear_stream_password_attempts_on_end()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    DELETE FROM stream_password_attempts WHERE stream_session_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS stream_password_attempts_cleanup ON stream_sessions;
CREATE TRIGGER stream_password_attempts_cleanup
  AFTER UPDATE OF ended_at ON stream_sessions
  FOR EACH ROW EXECUTE FUNCTION clear_stream_password_attempts_on_end();

CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address INET,
  country_code CHAR(2),
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS login_sessions_user_recent
  ON login_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_sessions_expiry
  ON login_sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_session_id UUID REFERENCES login_sessions(id) ON DELETE SET NULL,
  new_session_id UUID REFERENCES login_sessions(id) ON DELETE SET NULL,
  distance_km INTEGER NOT NULL,
  elapsed_minutes INTEGER NOT NULL,
  estimated_speed_kmh INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS login_anomaly_alerts_user_recent
  ON login_anomaly_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_anomaly_alerts_expiry
  ON login_anomaly_alerts (created_at);

CREATE TABLE IF NOT EXISTS step_up_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS step_up_recovery_codes_user
  ON step_up_recovery_codes (user_id) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS step_up_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS step_up_challenges_user_active
  ON step_up_challenges (user_id, expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS secret_rotation_checkpoints (
  secret_name TEXT PRIMARY KEY,
  last_user_id UUID,
  processed_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS totp_enrollments (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);