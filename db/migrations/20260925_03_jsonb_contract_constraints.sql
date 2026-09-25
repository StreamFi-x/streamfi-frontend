-- Enforce the JSONB contracts from 20260925_02 at the database layer (#1407).
--
-- Prerequisite: run the JSONB audit and resolve every row it reports as
-- "invalid" (see docs/data-integrity.md). The guard below aborts this
-- migration if any violating row still exists, because a NOT VALID CHECK
-- constraint is still evaluated on every UPDATE of a row — a single malformed
-- legacy value would otherwise make that user's row un-updatable (including
-- unrelated columns such as is_live).
--
-- Rollout:
--   1. guard + ADD CONSTRAINT ... NOT VALID inside one short transaction
--      (brief ACCESS EXCLUSIVE lock, no table scan while holding it);
--   2. VALIDATE CONSTRAINT outside the transaction (SHARE UPDATE EXCLUSIVE:
--      reads and writes continue during the scan).
-- If step 2 fails because a violating row was written between the guard and
-- step 1, the constraints stay in place for new writes; fix the row and
-- re-run the VALIDATE statements.

BEGIN;

DO $$
DECLARE
  violating integer;
BEGIN
  SELECT count(*) INTO violating
  FROM users
  WHERE NOT streamfi_jsonb_sociallinks_ok(sociallinks)
     OR NOT streamfi_jsonb_creator_ok(creator)
     OR NOT streamfi_jsonb_notifications_ok(notifications);

  IF violating > 0 THEN
    RAISE EXCEPTION
      '% users row(s) violate the JSONB contracts. Run the JSONB audit (GET /api/admin/jsonb-audit) and resolve them before applying this migration.',
      violating;
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_sociallinks_contract;
ALTER TABLE users
  ADD CONSTRAINT users_sociallinks_contract
  CHECK (streamfi_jsonb_sociallinks_ok(sociallinks)) NOT VALID;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_creator_contract;
ALTER TABLE users
  ADD CONSTRAINT users_creator_contract
  CHECK (streamfi_jsonb_creator_ok(creator)) NOT VALID;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_notifications_contract;
ALTER TABLE users
  ADD CONSTRAINT users_notifications_contract
  CHECK (streamfi_jsonb_notifications_ok(notifications)) NOT VALID;

COMMIT;

ALTER TABLE users VALIDATE CONSTRAINT users_sociallinks_contract;
ALTER TABLE users VALIDATE CONSTRAINT users_creator_contract;
ALTER TABLE users VALIDATE CONSTRAINT users_notifications_contract;
