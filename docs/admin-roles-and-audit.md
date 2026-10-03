# Admin roles and audit history

## Role migration

The `users.role` column is authoritative. Existing `admin` rows are promoted to `super_admin` by the admin-role migration. Before removing `ADMIN_PRIVY_IDS` and `ADMIN_WALLET_ADDRESSES` from deployment configuration, run `npx tsx scripts/migrate-admin-allowlist.ts` with the currently configured values and verify that every listed identity maps to a user. The runtime does not consult those variables. New assignments are available only to super-admins through `/api/admin/roles` and are recorded in the admin audit log.

`support` may review reports, `moderator` may review reports and perform moderation operations, and `super_admin` may use all admin capabilities. Authorization reads the current database role on each request so revocations take effect immediately.

## Audit history

Admin state changes use `withAdminAudit` so the mutation and append-only audit insert share one PostgreSQL transaction. Only relevant before/after fields should be recorded; never include credentials, tokens, or full user rows. The `/admin/audit-log` page supports actor, target, and time-window filters with bounded keyset pagination. Database triggers reject updates and deletes.

## Session location database

Set `GEOIP_CITY_DB_PATH` to a licensed local MaxMind City MMDB file and keep it updated through the deployment's approved data process. If it is not configured or a lookup misses, the session page displays `Unknown location`. Raw IP addresses are looked up on the server and are not returned to the browser.