-- migrate:no-transaction
--
-- Validates the JSONB contract constraints added NOT VALID by
-- 20260925210000_jsonb_contract_constraints. VALIDATE CONSTRAINT takes SHARE
-- UPDATE EXCLUSIVE, so reads and writes continue during the scan.

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND conname IN ('users_sociallinks_contract', 'users_creator_contract', 'users_notifications_contract')
      AND NOT convalidated
  LOOP
    EXECUTE format('ALTER TABLE users VALIDATE CONSTRAINT %I', con.conname);
  END LOOP;
END $$;
