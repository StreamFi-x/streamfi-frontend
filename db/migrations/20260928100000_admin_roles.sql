UPDATE users SET role = 'super_admin' WHERE role = 'admin';

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

CREATE INDEX IF NOT EXISTS users_privy_id_admin_role
  ON users (privy_id, role) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS users_wallet_admin_role
  ON users (LOWER(wallet), role) WHERE deleted_at IS NULL;