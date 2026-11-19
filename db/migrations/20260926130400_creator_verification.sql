-- Creator verification with a real review workflow (#1425).
--
-- Verification status lives in its own table (not a users column) so the
-- authoritative state, the state machine's history and admin decisions are
-- all in one place, and the badge can never be set by anything other than
-- an approved row here. Applications carry no document contents: evidence
-- is a reference (a private, admin-only-fetchable URL or an external
-- social-proof URL), never a blob, so it can never leak into logs or API
-- responses that select application columns broadly.

CREATE TABLE IF NOT EXISTS creator_verifications (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             TEXT        NOT NULL DEFAULT 'not_verified' CHECK (status IN (
                       'not_verified', 'submitted', 'under_review',
                       'approved', 'rejected', 'revoked')),
  evidence_type      TEXT        CHECK (evidence_type IN ('document', 'social_proof')),
  -- document: a reference into the platform's private upload store (never a
  -- public URL). social_proof: the external profile URL being cross-linked.
  evidence_reference TEXT,
  applicant_note     TEXT        CHECK (applicant_note IS NULL OR char_length(applicant_note) <= 1000),
  reviewer_note      TEXT,
  submitted_at       TIMESTAMPTZ,
  reviewed_by        TEXT,
  reviewed_at        TIMESTAMPTZ,
  approved_at        TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  revoked_reason     TEXT,
  -- Evidence retention: cleared by the retention job once a decision is
  -- final; NULL evidence_reference with a non-pending status means it has
  -- already been purged, not that it was never provided.
  evidence_purged_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creator_verifications_review CHECK (
    status NOT IN ('approved', 'rejected') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT creator_verifications_revocation CHECK (
    status <> 'revoked' OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
  )
);

-- One row per user carries current status; history of past cycles
-- (rejected -> re-applied -> approved, or approved -> revoked -> re-applied)
-- is preserved in workflow_audit_events rather than multiple live rows here,
-- so "is this creator verified right now" is always a single unambiguous
-- lookup with no ambiguity about which row is authoritative.
CREATE UNIQUE INDEX IF NOT EXISTS creator_verifications_one_per_user
  ON creator_verifications (user_id);

CREATE INDEX IF NOT EXISTS idx_creator_verifications_status
  ON creator_verifications (status, submitted_at);

-- The badge itself: a generated column so no code path can set "verified"
-- without an approved creator_verifications row existing.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_creator BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION sync_verified_creator_badge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users
  SET is_verified_creator = (NEW.status = 'approved')
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_verifications_sync_badge ON creator_verifications;
CREATE TRIGGER creator_verifications_sync_badge
  AFTER INSERT OR UPDATE OF status ON creator_verifications
  FOR EACH ROW EXECUTE FUNCTION sync_verified_creator_badge();

CREATE INDEX IF NOT EXISTS idx_users_verified_creator
  ON users (is_verified_creator) WHERE is_verified_creator;
