# Stellar Wallet Migration (#243)

## Decisions

### Wallet column

- **Column type:** Keep `VARCHAR(255)`. Stellar public keys are 56 characters; 255 allows future formats without another migration.
- **Optional:** To enforce Stellar-only, use `VARCHAR(56)` and add a migration; not applied here.

### Existing StarkNet data

- **Recommended (pre-production):** **Option A** — Wipe test data. If the database has no production users or only test StarkNet hex addresses, run:
  ```sql
  -- Only if pre-production and you want to clear StarkNet users
  -- DELETE FROM users WHERE wallet LIKE '0x%';
  ```
- **If preserving data:** **Option B** — Add `wallet_type` and backfill:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(10) DEFAULT 'stellar';
  UPDATE users SET wallet_type = 'starknet' WHERE wallet LIKE '0x%';
  ```
- **Otherwise:** **Option C** — Document that legacy StarkNet users must re-register with a Stellar wallet.

### Schema and queries

- **LOWER(wallet) removed** everywhere. Stellar public keys are uppercase; comparisons use exact match on `wallet`.
- **Indexes:** Use `users(wallet)` and `users(wallet, is_live)`; no expression index on `LOWER(wallet)`.

## Files changed in this implementation

- `db/schema.sql` — Dropped `idx_users_wallet_lower`; `get_user_stream_analytics()` uses exact `wallet` match.
- `scripts/optimize-database.sql` — Wallet indexes use `wallet` (not `LOWER(wallet)`).
- API routes: `streams/key`, `streams/delete-get`, `users/updates/[wallet]`, `users/wallet/[wallet]`, `debug/user-stream`, `streams/create` — all use exact `wallet` match.
- `lib/dev-mode.ts` — Dev test wallet replaced with a Stellar-format public key.

## One-time migration for existing databases

If the old schema with `idx_users_wallet_lower` was already applied, run once:

```sql
DROP INDEX IF EXISTS idx_users_wallet_lower;
-- Then redeploy get_user_stream_analytics (e.g. run db/schema.sql or the function definition).
```

## Migration checklist

- [x] Schema and indexes updated (no LOWER(wallet)).
- [x] API routes use exact wallet match.
- [x] PostgreSQL function `get_user_stream_analytics(wallet)` uses exact match.
- [ ] Run schema/migrations on each environment (staging, then production).
- [ ] If Option A: run wipe for StarkNet users when ready.
- [ ] Verify: new Stellar user registration and lookups by wallet work.
