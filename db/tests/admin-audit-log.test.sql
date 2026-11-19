BEGIN;

INSERT INTO admin_audit_log (actor_id, action, target_type, target_id)
VALUES ('test-admin', 'test_action', 'test_target', 'test-target-1');

DO $$
BEGIN
  BEGIN
    UPDATE admin_audit_log SET action = 'tampered' WHERE actor_id = 'test-admin';
    RAISE EXCEPTION 'expected admin audit UPDATE to fail';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'admin_audit_log is append-only' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    DELETE FROM admin_audit_log WHERE actor_id = 'test-admin';
    RAISE EXCEPTION 'expected admin audit DELETE to fail';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'admin_audit_log is append-only' THEN
      RAISE;
    END IF;
  END;
END;
$$;

ROLLBACK;