# StreamFi Scripts Directory Guide & Migration Safeguards

This directory contains database schema migrations, operational maintenance scripts, and diagnostic tools.

## 1. Directory Categorization

### One-Off Database Migrations (Tracked)
These scripts modify persistent database state or infrastructure secrets and must run through the **Migration Registry** (`scripts/migration-registry.ts`):
- `migrate-to-mux.sql`: Transition from legacy Livepeer schema to Mux.
- `audit-livepeer-legacy.ts`: Verifies no unmigrated stream assets remain.
- `migrate-admin-allowlist.ts`: Configures initial admin roles.
- `updateUserSchema.mjs`: Updates user schema columns.
- `migrate-custodial-keys-to-kms.ts`: Encrypts custodial private keys with KMS. **NON-IDEMPOTENT**.
- `rotate-stellar-encryption-key.ts`: Master key rotation. **NON-IDEMPOTENT**.
- `migrate-tip-counter.mjs`: Backfills tipping aggregation counts.

### Operational / Recurring Scripts (Un-tracked)
Ongoing operational jobs meant for periodic execution:
- `cron-cleanup-sessions.ts`: Periodic cleanup of stale session records.
- `backfill-analytics.ts`: Idempotent periodic analytics sync.
- `sync-job-schedules.ts`: Upstash QStash schedule synchronization.

---

## 2. Documented Execution Order & Dependency Matrix

Migrations must strictly execute in the order specified below. Dependent scripts will be automatically blocked by `migration-registry.ts` if prerequisites have not completed:

1. **Step 1:** `migrate-to-mux.sql` (Root migration)
2. **Step 2:** `audit-livepeer-legacy.ts` (Requires: `migrate-to-mux.sql`)
3. **Step 3:** `migrate-admin-allowlist.ts` (Independent)
4. **Step 4:** `updateUserSchema.mjs` (Independent)
5. **Step 5:** `migrate-custodial-keys-to-kms.ts` (Requires: `updateUserSchema.mjs`)
6. **Step 6:** `rotate-stellar-encryption-key.ts` (Requires: `migrate-custodial-keys-to-kms.ts`)
7. **Step 7:** `migrate-tip-counter.mjs` (Requires: `updateUserSchema.mjs`)

---

## 3. Idempotency Guarantees & Safeguards

- **Non-Idempotent Guard:** Scripts marked `isIdempotent: false` (such as KMS key encryption and master key rotation) record a persistent SHA-256 checksum and completion timestamp in `scripts/.migration-tracking.json`. If execution is attempted a second time, the runner halts with an explicit error to prevent double-encryption or key corruption.
- **Dry-Run Validation:** Use `npx tsx scripts/migration-registry.ts --dry-run` to verify safety before executing against staging or production.
- **Status Check:** Check status of all applied and pending migrations with `npx tsx scripts/migration-registry.ts --status`.
