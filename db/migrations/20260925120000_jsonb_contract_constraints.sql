-- Enforce the JSONB contracts from 20260925110000 at the database layer (#1407).
--
-- Prerequisite: run the JSONB audit and resolve every row it reports as
-- "invalid" (see docs/data-integrity.md). This migration aborts, and the
-- runner records nothing, while any violating row exists: a NOT VALID CHECK
-- constraint is still evaluated on every UPDATE of a row, so a single
-- malformed legacy value would otherwise make that user's row un-updatable
-- (including unrelated columns such as is_live).
--
-- The constraints are added NOT VALID here (brief lock, no scan) and validated
-- online by 20260925120100_validate_jsonb_contract_constraints. Columns that
-- do not exist in an environment are skipped.

DO $$
DECLARE
  checks CONSTANT text[][] := ARRAY[
    ARRAY['sociallinks',   'users_sociallinks_contract',   'streamfi_jsonb_sociallinks_ok'],
    ARRAY['creator',       'users_creator_contract',       'streamfi_jsonb_creator_ok'],
    ARRAY['notifications', 'users_notifications_contract', 'streamfi_jsonb_notifications_ok']
  ];
  i integer;
  violating integer;
BEGIN
  FOR i IN 1 .. array_length(checks, 1) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'users'::regclass AND attname = checks[i][1] AND NOT attisdropped
    ) THEN
      EXECUTE format('SELECT count(*) FROM users WHERE NOT %I(%I)', checks[i][3], checks[i][1])
        INTO violating;
      IF violating > 0 THEN
        RAISE EXCEPTION
          '% users row(s) violate the % contract. Run the JSONB audit (GET /api/admin/jsonb-audit) and resolve them before applying this migration.',
          violating, checks[i][1];
      END IF;
    END IF;
  END LOOP;

  FOR i IN 1 .. array_length(checks, 1) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'users'::regclass AND attname = checks[i][1] AND NOT attisdropped
    ) THEN
      EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', checks[i][2]);
      EXECUTE format(
        'ALTER TABLE users ADD CONSTRAINT %I CHECK (%I(%I)) NOT VALID',
        checks[i][2], checks[i][3], checks[i][1]
      );
    END IF;
  END LOOP;
END $$;
