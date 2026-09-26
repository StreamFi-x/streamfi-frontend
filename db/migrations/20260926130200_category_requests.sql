-- Creator category requests and admin review (#1429).
--
-- Approved requests create rows in the existing stream_categories table, so
-- they are served by /api/category like every other category. Merged requests
-- point at an existing category and add the proposed name to its tags, which
-- /api/category?tag= already searches.

CREATE TABLE IF NOT EXISTS stream_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  tags        TEXT[],
  imageurl    VARCHAR(255),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_title  TEXT        NOT NULL CHECK (char_length(proposed_title) BETWEEN 2 AND 50),
  -- lib/categories/normalize.ts: case, accents, spacing and punctuation removed.
  normalized_key  TEXT        NOT NULL CHECK (normalized_key <> ''),
  rationale       TEXT        NOT NULL CHECK (char_length(rationale) BETWEEN 20 AND 1000),
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  decision_reason TEXT,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  -- The created category (approved) or the merge target (merged).
  category_id     UUID        REFERENCES stream_categories(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT category_requests_decision CHECK (
    status = 'pending'
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT category_requests_rejection_reason CHECK (
    status <> 'rejected' OR decision_reason IS NOT NULL
  ),
  CONSTRAINT category_requests_target CHECK (
    status NOT IN ('approved', 'merged') OR category_id IS NOT NULL
  )
);

-- Two creators asking for "Speedrunning" and "Speed Running" land on the same
-- key; only one of them can be waiting for review.
CREATE UNIQUE INDEX IF NOT EXISTS category_requests_one_pending_per_key
  ON category_requests (normalized_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_category_requests_requester
  ON category_requests (requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_category_requests_status
  ON category_requests (status, created_at);
