-- JSONB contracts for users.sociallinks, users.creator and users.notifications (#1407).
--
-- The Zod schemas in lib/db/jsonb-contracts.ts are the source of truth for the
-- exact shape of these columns. The functions below enforce the coarse
-- structural invariant that every current AND recognised legacy shape
-- satisfies, so that direct SQL, scripts and future code paths cannot store a
-- value of the wrong JSON type:
--
--   sociallinks   NULL, an object whose values are all strings/null (current
--                 {platform: url} map), or an array of objects (legacy
--                 [{socialTitle, socialLink}] / [{platform, title, url}]).
--   creator       NULL or an object; known keys must have the documented JSON
--                 type (string/null, tags = array of strings, socialLinks =
--                 sociallinks shape, subscription prices = number/string/null).
--                 Unknown keys are left to the app layer.
--   notifications NULL or a jsonb[] whose elements are objects with string
--                 title/text; optional id/type/created_at strings and read
--                 boolean (current shape and legacy {title, text}).
--
-- This file only defines functions and the quarantine table; the CHECK
-- constraints are added by 20260925210000_jsonb_contract_constraints after
-- the audit has run. Idempotent.

CREATE OR REPLACE FUNCTION streamfi_jsonb_sociallinks_ok(v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  el jsonb;
  kv record;
BEGIN
  IF v IS NULL THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(v) = 'object' THEN
    FOR kv IN SELECT * FROM jsonb_each(v) LOOP
      IF jsonb_typeof(kv.value) NOT IN ('string', 'null') THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  IF jsonb_typeof(v) = 'array' THEN
    FOR el IN SELECT * FROM jsonb_array_elements(v) LOOP
      IF jsonb_typeof(el) <> 'object' THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION streamfi_jsonb_creator_ok(v jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  kv record;
  tag jsonb;
BEGIN
  IF v IS NULL THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(v) <> 'object' THEN
    RETURN false;
  END IF;

  FOR kv IN SELECT * FROM jsonb_each(v) LOOP
    IF kv.key IN ('streamTitle', 'title', 'description', 'category', 'payout', 'thumbnail',
                  'lastUpdated', 'customThumbnailUrl', 'customThumbnailUpdatedAt') THEN
      IF jsonb_typeof(kv.value) NOT IN ('string', 'null') THEN
        RETURN false;
      END IF;
    ELSIF kv.key IN ('subscriptionPrice', 'subscription_price_usdc') THEN
      IF jsonb_typeof(kv.value) NOT IN ('number', 'string', 'null') THEN
        RETURN false;
      END IF;
    ELSIF kv.key = 'tags' THEN
      IF jsonb_typeof(kv.value) = 'null' THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(kv.value) <> 'array' THEN
        RETURN false;
      END IF;
      FOR tag IN SELECT * FROM jsonb_array_elements(kv.value) LOOP
        IF jsonb_typeof(tag) <> 'string' THEN
          RETURN false;
        END IF;
      END LOOP;
    ELSIF kv.key = 'socialLinks' THEN
      IF NOT streamfi_jsonb_sociallinks_ok(kv.value) THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION streamfi_jsonb_notifications_ok(v jsonb[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  el jsonb;
BEGIN
  IF v IS NULL THEN
    RETURN true;
  END IF;

  FOREACH el IN ARRAY v LOOP
    IF el IS NULL OR jsonb_typeof(el) <> 'object' THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(el -> 'title') IS DISTINCT FROM 'string'
       OR jsonb_typeof(el -> 'text') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;
    IF el ? 'read' AND jsonb_typeof(el -> 'read') <> 'boolean' THEN
      RETURN false;
    END IF;
    IF el ? 'id' AND jsonb_typeof(el -> 'id') <> 'string' THEN
      RETURN false;
    END IF;
    IF el ? 'type' AND jsonb_typeof(el -> 'type') <> 'string' THEN
      RETURN false;
    END IF;
    IF el ? 'created_at' AND jsonb_typeof(el -> 'created_at') <> 'string' THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Values that cannot be repaired automatically are moved here by an explicit
-- admin action (POST /api/admin/jsonb-audit with action=quarantine) instead of
-- being discarded. original_value always holds the complete pre-change value.
CREATE TABLE IF NOT EXISTS jsonb_quarantine (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     TEXT        NOT NULL,
  row_id         UUID        NOT NULL,
  column_name    TEXT        NOT NULL,
  original_value JSONB       NOT NULL,
  reason         TEXT        NOT NULL,
  quarantined_by TEXT,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jsonb_quarantine_row
  ON jsonb_quarantine (table_name, row_id);
