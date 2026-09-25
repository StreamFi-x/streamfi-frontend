# Admin authentication brute-force protection (#1398)

Admin access is guarded by a dedicated, stricter path than the general rate
limiter (`lib/rate-limit.ts`). This is intentionally separate: the general
limiter counts requests per fixed window, while the admin guard counts
**failed admin authentication attempts** and escalates.

Code: `lib/security/admin-auth-throttle.ts` (policy), `lib/admin-auth.ts`
(entry points), `lib/security/alerts.ts` (alerting).

## Protected entry points

Every admin authorization mechanism in the app goes through
`guardAdminAttempt`:

| Mechanism                                                                            | Used by                                                                                                                                           | Credential tracked |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `privy_session` cookie ∈ `ADMIN_PRIVY_IDS` (+ active, unrevoked `user_sessions` row) | `/api/admin/*`, `/api/category` (writes), `routes-f/admin-user-suspend`, `routes-f/featured-streams-set`, `routes-f/cron-close-inactive-sessions` | cookie value       |
| `verifySession` + `users.role = 'admin'`                                             | `routes-f/admin-feature-flag-list`, `-update`, `admin-user-search`, `admin-user-unsuspend`                                                        | user id            |
| `verifySession` + `isAdmin()` allowlist                                              | `/api/admin/feature-flags`                                                                                                                        | user id            |
| `x-internal-secret` header (constant-time compare)                                   | `routes-f/cron-close-inactive-sessions`                                                                                                           | header value       |

Credentials are only ever stored, logged or alerted as a truncated SHA-256
fingerprint; IPs appear in alerts masked (`1.2.3.x`).

## Policy

Failures are tracked per **source IP** and per **presented credential**,
each remembered for 24h after the latest failure.

| Failure # (per IP or credential) | Block before next attempt |
| -------------------------------- | ------------------------- |
| 1–2                              | none                      |
| 3                                | 30 s                      |
| 4                                | 1 min                     |
| 5                                | 2 min                     |
| n                                | 30 s × 2^(n−3)            |
| 10+                              | 1 h (cap)                 |

- While blocked, requests get `429` with `Retry-After` **before any
  authentication work runs**.
- Attempts are counted _before_ authenticating and the block is claimed
  atomically, so a burst of parallel requests cannot race past it.
- A successful admin authentication clears that IP's and credential's
  failure state.
- There is **no permanent lockout**: the maximum block is 1h, so an attacker
  cannot lock an administrator out for good. An attacker sharing an admin's
  IP can delay that admin by at most 1h; the admin can use another network.
- Compare with the general session exchange (`POST /api/auth/session`): 10
  requests/min per IP, no escalation — ~14,400 guesses/day. The admin path
  allows roughly 13 guesses in the first hour and then 1/hour per IP and per
  credential.
- A **global** counter (10-minute buckets) catches distributed attacks that
  rotate both IPs and credentials. It alerts but never blocks — a global
  block would be a trivial DoS against real admins.
- If the throttle store (Upstash Redis) is unreachable, admin access **fails
  closed** with `503` and a critical alert.

State lives in the same Upstash Redis as `lib/rate-limit.ts`
(`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Without it, an
in-memory per-instance store is used — acceptable for local dev only.

## Alerts

| Trigger                                           | Severity |
| ------------------------------------------------- | -------- |
| 5 failures from one IP or against one credential  | warning  |
| 10 failures from one IP or against one credential | critical |
| 20 failures across all sources in 10 minutes      | critical |
| Throttle store unavailable                        | critical |

Each alert includes mechanism, route, masked source IP, credential
fingerprint, failure count, window, current block duration and environment —
never passwords, cookies, tokens or request bodies.

Flood control: each (scope, level) alerts at most once per hour, and at most
`OPS_ALERT_HOURLY_BUDGET` (default 20) alerts per category are delivered per
hour regardless of how many IPs an attacker rotates through. Suppressed
alerts are still written to the logs as `operational_alert`.

## Configuration

| Variable                                             | Purpose                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `OPS_ALERT_WEBHOOK_URL`                              | Slack/Discord-compatible incoming webhook for all operational alerts. Unset = log only. |
| `OPS_ALERT_HOURLY_BUDGET`                            | Max delivered alerts per category per hour (default 20).                                |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared throttle state (required in production).                                         |

## Structured log events

`admin_auth_failed`, `admin_auth_throttled`, `admin_auth_guard_unavailable`,
`operational_alert` (`alert_event: admin_auth_alerted`).

## Known limitation (follow-up)

The `privy_session` cookie holds the raw Privy DID and is not signed. Anyone
who learns an admin's DID can present it directly. Throttling bounds
_guessing_ DIDs but cannot stop replay of a known one; signing that cookie
(as `wallet_session` already is) and/or step-up 2FA for admin routes should
follow.
