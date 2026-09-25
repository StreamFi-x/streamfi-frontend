# Data integrity and reconciliation

This document covers four related pieces of infrastructure:

1. [JSONB contracts](#1-jsonb-contracts-1407) for `users.sociallinks`, `users.creator` and `users.notifications` (#1407)
2. [Account deletion: tombstones and delayed purge](#2-account-deletion-tombstones-and-delayed-purge-1406) (#1406)
3. [Mux asset ↔ recordings and clips consistency sweep](#3-mux-asset--recordings-and-clips-sweep-1409) (#1409)
4. [Tip reconciliation and anomaly alerting](#4-tip-reconciliation-and-anomaly-alerting-1405) (#1405)

The [scheduled jobs](#scheduled-jobs), [configuration](#configuration) and
[deployment order](#deployment) sections apply to all of them.

---

## 1. JSONB contracts (#1407)

### Columns

| Column                | Type      | Canonical shape                                                                                          |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `users.sociallinks`   | `JSONB`   | `{ [platform]: "https://…" }` — at most 20 entries, http(s) URLs only                                    |
| `users.creator`       | `JSONB`   | `{ streamTitle?, description?, category?, tags?: string[], payout?, thumbnail?, lastUpdated? }` (strict) |
| `users.notifications` | `JSONB[]` | elements `{ id: uuid, type: "follow" \| "live", title, text, read: boolean, created_at: ISO-8601 }`      |

`socialLinks` in the original schema is unquoted, so Postgres folds it to
`sociallinks`; `notifications` is a Postgres array of `jsonb`, not a JSON array.

The Zod schemas in `lib/db/jsonb-contracts.ts` are the source of truth.

### Recognised legacy shapes

| Column          | Legacy shape                                                                                                                                                                                             | Handling                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `sociallinks`   | `[{ socialTitle, socialLink }]` (original schema, `types/user.ts`)                                                                                                                                       | normalised to the map (platform from the URL, same rules as the settings page) when no two links map to the same platform     |
| `sociallinks`   | `[{ platform?, url, title? }]` (also written by `/api/routes-f/profile-update-social-links`)                                                                                                             | normalised to the map (platform lower-cased, or detected from the URL when absent)                                            |
| `sociallinks`   | `[]` (registration default)                                                                                                                                                                              | normalised to `{}`                                                                                                            |
| any             | double-encoded JSON string                                                                                                                                                                               | decoded when the inner document is valid                                                                                      |
| `creator`       | `title` (old name of `streamTitle`), `socialLinks` (read by `watch`)                                                                                                                                     | still valid, no longer written                                                                                                |
| `creator`       | `customThumbnailUrl` / `customThumbnailUpdatedAt` (set by `/api/routes-f/preview/custom`), `subscriptionPrice` / `subscription_price_usdc` (read by `streams/key`, `streams/update`, `users/[username]`) | valid; prices may be a number or a numeric string                                                                             |
| `creator`       | `null`-valued keys                                                                                                                                                                                       | normalised by dropping the key (readers treat `null` and absent the same)                                                     |
| `notifications` | `{ title, text }` (first notifications endpoint, commit `4180b04`)                                                                                                                                       | kept as stored; `readNotifications()` presents it with a deterministic id, `type: "legacy"`, `read: true`, `created_at: null` |

### Write paths

Every application write goes through the contract helpers:

| Write site                                                                    | Helper                                 | Semantics                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `POST /api/users/register`                                                    | `prepareSocialLinks`, `prepareCreator` | validated before the Mux stream is created                          |
| `PUT /api/users/updates/[wallet]`, `PUT /api/users/updates/privy/[privyId]`   | `parseProfileJsonbFields`              | full replace; an absent field keeps the stored value (`COALESCE`)   |
| `PATCH /api/users/update-creator`                                             | `prepareCreator`                       | full replace                                                        |
| `PATCH /api/routes-f/profile-update-social-links`                             | `prepareSocialLinks`                   | full replace; stored as the canonical map, response shape unchanged |
| `/api/routes-f/preview/custom`                                                | —                                      | SQL `jsonb_set` of the two custom-thumbnail keys; shape-preserving  |
| `POST /api/streams/create`, `PATCH /api/streams/update`                       | `prepareCreatorPatch`                  | partial update merged in SQL: `creator = creator \|\| patch::jsonb` |
| `lib/notifications.ts` (`writeNotification`), `POST /api/users/notifications` | `buildNotification`                    | append one validated element                                        |
| `PATCH /api/users/notifications` (mark all read)                              | —                                      | SQL `jsonb_set` of `read`; shape-preserving                         |

Partial updates are validated as patches and merged by Postgres, so two
concurrent updates to different keys do not overwrite each other. A patch is
only merged into `NULL` or an object; a malformed stored value returns `409`
and must be repaired through the audit.

New code that writes one of these columns must use the helpers above.

### Database enforcement

Postgres has no built-in JSON Schema support, and `pg_jsonschema` is not
available on every host, so the database enforces a coarser structural
invariant through `IMMUTABLE` functions used in `CHECK` constraints
(`db/migrations/20260925_02` and `_03`):

- `sociallinks`: `NULL`, an object whose values are strings/`null`, or an array of objects;
- `creator`: `NULL` or an object; known keys must have the documented JSON type;
- `notifications`: every element is an object with string `title` and `text`; optional `id`, `type`, `created_at` strings and `read` boolean.

These accept every current and recognised legacy shape, so direct SQL cannot
store a value of the wrong JSON type, while the exact shape (URL format, enum
values, lengths, unknown keys) stays in the application layer where it can
evolve and produce useful errors. Rows that violate the invariant would make
every `UPDATE` of that user fail, which is why migration `_03` refuses to run
until the audit reports none.

### Audit, normalisation and quarantine

`GET /api/admin/jsonb-audit?cursor=&limit=` (admin) classifies each value as:

- `valid`
- `normalizable` — legacy/double-encoded, with a deterministic lossless canonical form
- `legacy` — recognised, readable, but no lossless canonical form (e.g. two links for one platform); left in place
- `nonconforming` — allowed by the database constraint but fails the schema (e.g. `ftp://` URL, unknown key); needs review
- `invalid` — violates the database invariant; must be fixed before migration `_03`

The report lists user ids, columns and schema issue paths — never stored values.
Page through with `nextCursor`.

Repairs are explicit admin actions, one batch per call:

- `POST /api/admin/jsonb-audit {"action":"normalize"}` rewrites `normalizable` values;
- `POST /api/admin/jsonb-audit {"action":"quarantine"}` moves `invalid` values into
  `jsonb_quarantine` (complete original value, reason, admin id) and resets the column
  (`{}`), or, for `notifications`, removes only the invalid elements.

Each write is conditional on the stored value still being the one that was
classified; a concurrent change is counted as `skippedConcurrentChange` and
left alone. Each call is recorded in `job_runs` (`job_name = 'jsonb-audit'`).
No migration rewrites or deletes data.

### Evolving a schema

- Add new fields as **optional** in `lib/db/jsonb-contracts.ts`. Old rows stay valid.
- A new notification type is added to `NOTIFICATION_TYPES`.
- Never make an existing optional field required. To rename a field, keep the old
  key as a deprecated optional key, write only the new one, backfill through the
  audit, and remove the old key once the audit reports no rows using it.
- If a change affects the JSON type of a key the database checks, update the
  function in a new migration with `CREATE OR REPLACE FUNCTION`. Existing rows are
  not re-checked by `CREATE OR REPLACE`; run the audit afterwards.

---

## 2. Account deletion: tombstones and delayed purge (#1406)

### Lifecycle

```
ACTIVE ──request──▶ pending (users.deleted_at set) ──cancel──▶ cancelled (ACTIVE again)
                       │
                       │ purge_after reached, no legal hold
                       ▼
                    purging ──step fails──▶ failed ──next run──▶ purging
                       │
                       ▼
                    purged  (users row kept as a PII-free tombstone)
```

State lives in `user_deletions` (one open row per user, enforced by a partial
unique index) plus `users.deleted_at` for fast filtering. The grace window is
`ACCOUNT_DELETION_GRACE_DAYS` (default 30).

| Endpoint                                               | Who               | Effect                                                        |
| ------------------------------------------------------ | ----------------- | ------------------------------------------------------------- |
| `POST /api/users/me/deletion {"confirm":"<username>"}` | the account owner | request deletion of the caller's own account                  |
| `GET /api/users/me/deletion`                           | the account owner | current status                                                |
| `DELETE /api/users/me/deletion`                        | the account owner | cancel (allowed while tombstoned)                             |
| `DELETE /api/admin/users/[userId]?reason=`             | admin             | request deletion (this used to be a hard `DELETE FROM users`) |
| `GET /api/admin/users/deletions?status=`               | admin             | pending / purging / failed deletions (or any status)          |
| `DELETE /api/admin/users/[userId]/deletion`            | admin             | cancel                                                        |
| `PATCH /api/admin/users/[userId]/deletion`             | admin             | `{"legalHold": true, "reason": "…"}` or `{"action": "retry"}` |

The admin users page (`/admin/users`) shows a **Pending deletion** badge for
tombstoned accounts with a cancel action; its delete button now starts this
lifecycle instead of hard-deleting.

The user id always comes from the verified session or the admin route; a user
cannot act on another account. Admin actions record the admin's Privy id.

Requesting and cancelling are single SQL statements. Cancellation is only
possible while no purge step has run (`status` pending/failed and
`completed_steps` empty). A purge worker claims a deletion with the same kind of
conditional update, so cancel and purge cannot both succeed. Repeating a
request or a cancel is a no-op.

While tombstoned, the account's Mux live stream is disabled (best effort;
re-enabled on cancel) and the account cannot use authenticated endpoints:
`verifySession` returns `403 ACCOUNT_PENDING_DELETION` except for routes that
opt in (`/api/users/me/deletion`, `/api/auth/export-key`). Sign-in itself still
works so the owner can cancel.

### What tombstoned users look like

Public and user-facing reads exclude tombstoned users immediately: profiles,
search, live/explore listings, top users, followers/following and their counts,
stream and playback lookups, recordings and clips, chat history, sitemap, schedule
reminders and notifications, and the routes-f profile, follow, history,
recommendation, raid, co-streamer, whitelist, preview, analytics, referral and
magic-link / password-reset lookups. Their content is hidden, not deleted, until the
purge, and reappears if the deletion is cancelled.

Internal paths deliberately include them: admin views (the admin user list
returns `deleted_at`), the Mux webhook, reconciliation jobs, the JSONB audit,
and identifier-uniqueness checks. In creator earnings, tips/gifts/subscriptions
from a tombstoned or purged supporter are still listed but the supporter
username is `null`.

`__tests__/lib/users/tombstone-filtering.test.ts` fails when a new SQL query on
`users` (a `sql` template or a template string passed to `.query(`) neither
filters `deleted_at` nor carries a `tombstone-aware: <reason>` comment (or lives
in a file on the internal allowlist in that test).

### Re-registration

Email, wallet and username stay reserved while the account is tombstoned;
registering with them returns `409 ACCOUNT_PENDING_DELETION`. The purge
replaces them with `deleted_<id>` / `purged_<id>` values, after which they can
be registered again. Unique constraints are unchanged.

### Purge

`GET /api/routes-f/cron-purge-deleted-users` (daily). For each due, unheld deletion
(up to 25 per run, claimed with `FOR UPDATE SKIP LOCKED` and a 15-minute claim):

1. **custodial wallet check** (every attempt) — the purge scrubs
   `users.encrypted_stellar_key`. If that wallet still holds more than
   `PURGE_CUSTODIAL_MAX_XLM` (default 2) XLM or any other asset, the purge fails
   with a clear error until the funds are moved or the key exported. A Horizon
   error also fails the attempt; it is never treated as an empty wallet.
2. `mux_assets` — delete the Mux assets of the user's recordings and clips (404 = done)
3. `mux_live_stream` — delete the Mux live stream
4. `media` — delete avatar, banner and stream thumbnail uploaded to Cloudinary (preset icons are skipped)
5. `database` — `streamfi_purge_user()`, one transaction

Each step is idempotent and recorded in `completed_steps`, so a retried purge
resumes where it stopped. The legal hold is re-checked before every step. A
failed user is recorded (`status = 'failed'`, `last_error`) and the run moves on
to the next user; failures are retried on later runs up to 5 attempts, then wait
for `{"action":"retry"}`. A deletion is only marked `purged` by the database
step itself.

### Foreign-key policy

`streamfi_purge_user()` walks every foreign key that references `users(id)`
and applies an explicit policy. **A foreign key without a policy aborts the
purge** (and nothing is changed), so a table added later cannot be silently
skipped or silently cascade.

| Policy   | Tables / columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| delete   | `stream_sessions.user_id` (cascades to its chat, viewers), `chat_messages.user_id`, `user_follows.*`, `stream_recordings.user_id`, `stream_clips.clipped_by/streamer_id`, `stream_schedule.creator_id`, `stream_reminders.viewer_id`, `user_badges.user_id`, `stream_tags.stream_id`, `tag_suggestions.suggested_by`, `channel_emotes.creator_id`, `channel_panels`, `stream_whitelist.*`, `stream_markers`, `stream_extensions`, `co_stream_invites.*`, `raids.*`, `squad_members.*`, `watch_history.*`, `user_preferences`, `user_overlay_config`, `user_sessions`, `user_two_factor`, email-verification / magic-link / password-reset tokens, `transcription_jobs`, experiment events and assignments, the `route_f_*` analytics and moderation-report tables, `mock_*_transactions.creator_id` |
| set NULL | `chat_messages.moderated_by`, `stream_viewers.user_id`, `moderation_queue.reporter_id/reported_user_id/assigned_to`, `moderation_audit_log.moderator_id`, `mock_*_transactions.viewer_id`, `users.referred_by`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| preserve | `tip_transactions.*`, `gift_transactions.*`, `subscriptions.*`, `subscription_tiers.creator_id`, `payouts.user_id`, `route_f_revenue_events.channel_id`, `user_deletions.user_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Financial records are preserved: they keep pointing at the users row, which
the purge scrubs of personal data (email, Privy id, custodial key, bio, avatar,
banner, social links, creator metadata, notifications, stream keys and Mux ids)
instead of deleting. Migration `_04` also changed the financial foreign keys
that used `ON DELETE CASCADE` (`tip_transactions`, `gift_transactions`,
`subscriptions`, `subscription_tiers`, `payouts`) to `ON DELETE RESTRICT`, so an
accidental `DELETE FROM users` can no longer erase financial history.
`verification_tokens` rows for the user's email are deleted.

Not covered (no foreign key to `users`): `stream_reports` / `bug_reports`
store a free-text `reporter_id`, and `waitlist` is keyed by email and managed
separately.

---

## 3. Mux asset ↔ recordings and clips sweep (#1409)

Two tables reference Mux assets: `stream_recordings` (written by the
`video.asset.ready` webhooks) and `stream_clips` (rows whose `mux_asset_id` is
set). A row and an asset correspond when `<table>.mux_asset_id = asset.id`.
Playback ids are carried for investigation only. Findings record which table
the row lives in (`row_table`, `row_id`).

`GET /api/routes-f/cron-mux-reconciliation` (daily):

1. Lists every Mux asset (100 per page, at most 200 pages; the SDK retries
   429/5xx/timeouts). Any listing error ends the listing and marks the run
   `partial`.
2. **Mux asset without a DB row** — an asset is only eligible once it is older
   than **36 hours**, not `preparing` and not live. The row is written by the
   `video.asset.ready` webhook; a live recording asset can exist for up to Mux's
   12-hour maximum live duration and Mux redelivers a failed webhook for up to
   24 hours. Candidates are re-checked against the database immediately before
   a finding is recorded, so a webhook landing during the sweep is not flagged.
3. **DB row without a Mux asset** — for both tables; only runs when the listing was complete.
   Rows younger than **1 hour** are skipped (rows are written after the asset is
   ready, so this only covers very recent writes). A row absent from the listing
   is flagged only after a direct `GET /assets/:id` returns **404**; a timeout or
   other error is counted as `check_failed` and flags nothing. At most 200 such
   checks per run.

Mux timestamps are compared with the database clock (`SELECT now()`), with a
5-minute skew allowance.

### Reporting

Findings are stored in `mux_drift_findings` (one open finding per kind and
asset; repeated detections increment `detection_count`). Each run is recorded in
`job_runs` with: assets listed, rows scanned, matched, `recent_propagation`,
both drift counts, new findings, auto-hidden, resolved, `check_failed` (with up
to 20 asset ids), and whether direction B was skipped.

`GET /api/admin/reconciliation/mux?status=open` returns findings and the last
10 runs.

### Remediation

Nothing is deleted automatically.

| Drift                    | Automatic                                                                                                                                                                                                                                                                                                                   | Admin (`POST /api/admin/reconciliation/mux {"findingId","action"}`)                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Mux asset without DB row | none; resolved automatically if the row appears or the asset disappears (confirmed 404)                                                                                                                                                                                                                                     | `adopt` — create the recording for the live stream's (active) owner; `delete_mux_asset` — only if still no row references it; `dismiss` |
| DB row without Mux asset | after **two** 404 confirmations at least 24 hours apart, the recording or clip is hidden (`status = 'unavailable'`, `unavailable_at`; migration `_05` adds `unavailable` to the `stream_clips` status check); the row and its previous status are kept. Resolved automatically if the asset reappears or the row is deleted |

Every public read already filters `status = 'ready'`, so hidden recordings and
clips stop appearing in the UI.

Related changes that reduce drift at the source: both asset webhooks
(`/api/webhooks/mux` and `/api/routes-f/webhooks-mux-asset`) now share one
upsert and return `500` when saving the recording fails, so Mux redelivers the
event instead of the asset being orphaned; deleting a recording or a clip also
deletes its Mux asset (a failure there is left for the sweep to report).

---

## 4. Tip reconciliation and anomaly alerting (#1405)

### Reconciliation

No tip reconciliation existed before this change; the alerting layer needed
one to observe. `GET /api/routes-f/cron-tip-reconciliation` (hourly) compares, for
every creator with at least one `tip_transactions` row, the incoming native XLM
payments of the last `TIP_RECONCILIATION_LOOKBACK_HOURS` (default 72) — the same
payment filter as `/api/tips/refresh-total` — with the stored rows (written by
`refresh-total` and the Stellar payment webhook), by
transaction hash (payments in one transaction are summed; the table stores one
row per hash):

| Kind                   | Meaning                                         | Action                               |
| ---------------------- | ----------------------------------------------- | ------------------------------------ |
| `MISSING_TIP_INSERTED` | on the ledger, not stored                       | row inserted (`price_usd` left NULL) |
| `AMOUNT_CORRECTED`     | stored amount differs from the ledger           | amount updated                       |
| `CREATOR_MISMATCH`     | the transaction is stored under another creator | flagged only                         |
| `NOT_ON_LEDGER`        | stored row with no matching payment             | flagged only (never deleted)         |

Every applied correction and its row in `tip_reconciliation_corrections` are
written by one statement, and every correction is conditional (`ON CONFLICT DO
NOTHING`, `WHERE amount_xlm = <value read>`), so retries, overlapping runs and a
concurrent `/api/tips/refresh-total` cannot apply a correction twice or
overwrite newer data. `NOT_ON_LEDGER` is only evaluated when the whole window
was read, and rows within 1 hour of the window edge are not checked. Horizon
calls are retried 3 times with exponential backoff on 429/5xx/network errors;
a creator that still fails is skipped for this run (the run is `partial`) and
never treated as "no payments". Amounts are handled as integer stroops
(`lib/stellar/amounts.ts`); stored as `NUMERIC(20,7)`.

`/api/tips/refresh-total` and `/api/routes-f/webhooks-stellar-payment` used
`ON CONFLICT (tx_hash)`, which cannot use the partial unique index on `tx_hash`
and made every insert fail; both now name the index predicate. `refresh-total`
sums amounts exactly, and the payment webhook only updates the creator's tip
totals when the row is new, so a redelivered webhook no longer counts twice.

### Baseline and thresholds

After each run the evaluator aggregates the run's corrections and compares them
with up to `TIP_ALERT_BASELINE_RUNS` (30 — about 30 hours at the hourly
schedule) previous completed or partial runs. Runs with no corrections count as
zeros.

For **count** (corrections applied) and **magnitude** (sum of |delta|)
separately:

```
threshold = max(floor, median + K × 1.4826 × MAD, RATIO × median)
```

with `K = 4`, `RATIO = 3`, count floor 5 and magnitude floor 100 XLM. Median and
MAD are robust to occasional spikes, so one incident does not raise the bar for
the next. The floor stops a quiet baseline (all zeros) from alerting on a single
correction; the ratio term covers baselines with no spread.

Independently of the baseline:

| Reason                     | Condition                                     | Severity |
| -------------------------- | --------------------------------------------- | -------- |
| `LARGE_SINGLE_CORRECTION`  | any single correction ≥ 500 XLM               | critical |
| `LEDGER_MISMATCH`          | any `NOT_ON_LEDGER` / `CREATOR_MISMATCH` flag | critical |
| `RUN_FAILED`               | the run failed or was abandoned               | critical |
| `COUNT_ABOVE_BASELINE`     | count above its threshold                     | warning  |
| `MAGNITUDE_ABOVE_BASELINE` | magnitude above its threshold                 | warning  |

**Cold start**: with fewer than 5 previous runs there is no baseline; only
`COLD_START_COUNT` (≥ 25 corrections) and `COLD_START_MAGNITUDE` (≥ 1000 XLM)
plus the baseline-independent rules apply. All values are configurable
(see [Configuration](#configuration)).

### Delivery, deduplication and failure handling

- Alerts are stored in `reconciliation_alerts` with fingerprint
  `tip-reconciliation:run:<run id>`, so re-evaluating a run never creates a second alert.
- An alert whose signature (reason codes, order of magnitude of the correction
  amount, and the set of flagged transactions) matches an alert delivered within
  `TIP_ALERT_COOLDOWN_HOURS` (6) is stored as `suppressed` instead of sent. An
  escalation or a new flagged transaction produces a new signature and is sent.
- Alerts are emailed to `RECONCILIATION_ALERT_EMAILS` through the existing
  nodemailer/Gmail transport (`EMAIL_USER`, `EMAIL_PASS`). The payload contains
  the run id and timestamps, observed metrics, baseline statistics, the exceeded
  thresholds and up to 50 affected corrections (transaction hash, creator id,
  tip id, before/after/delta). No usernames, wallets or emails.
- Each alert is claimed before sending, so two invocations never send it twice.
  A delivery failure (including no recipients configured) is recorded as
  `failed` with the error, logged, and retried on the next run, up to 5 attempts.
  An alert is never marked delivered unless the send succeeded.
- A run is marked `alert_evaluated_at` only after evaluation succeeds. Every
  invocation re-evaluates unevaluated runs from the last 7 days (including runs
  that crashed or were abandoned), so a failed evaluation is retried rather than
  lost.

### Investigating

`GET /api/admin/reconciliation/tips` returns recent runs with their correction
totals, recent alerts (including failed and suppressed ones) and runs still
awaiting evaluation. The corrections of a run are in
`tip_reconciliation_corrections` (`run_id`).

---

## Scheduled jobs

| Job                | Endpoint                                 | Schedule (`vercel.json`) |
| ------------------ | ---------------------------------------- | ------------------------ |
| Tip reconciliation | `/api/routes-f/cron-tip-reconciliation`  | hourly at :15            |
| Mux sweep          | `/api/routes-f/cron-mux-reconciliation`  | daily 03:30 UTC          |
| Account purge      | `/api/routes-f/cron-purge-deleted-users` | daily 04:00 UTC          |

All three:

- require `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it); they return
  401 when `CRON_SECRET` is not set;
- take a database lease (`job_leases`) so only one instance runs a job at a time — an
  overlapping invocation returns `skipped_locked`. Session-level advisory locks are
  not used because `@vercel/postgres` may run consecutive queries on different
  connections;
- record a `job_runs` row with metrics (`completed`, `partial`, `failed`; a run
  left `running` by a crashed worker becomes `abandoned`);
- stop before their time budget (below `maxDuration = 300`) and report `partial`
  instead of being killed mid-step;
- log one JSON line per run (`{"job": …, "outcome": …, "metrics": …}`).

## Configuration

| Variable                             | Default | Used by                                                   |
| ------------------------------------ | ------- | --------------------------------------------------------- |
| `CRON_SECRET`                        | —       | all cron endpoints (required)                             |
| `ADMIN_PRIVY_IDS`                    | —       | admin endpoints (existing)                                |
| `ACCOUNT_DELETION_GRACE_DAYS`        | 30      | deletion                                                  |
| `PURGE_CUSTODIAL_MAX_XLM`            | 2       | purge custodial-wallet check                              |
| `TIP_RECONCILIATION_LOOKBACK_HOURS`  | 72      | tip reconciliation                                        |
| `RECONCILIATION_ALERT_EMAILS`        | —       | alert recipients, comma-separated (required for delivery) |
| `EMAIL_USER`, `EMAIL_PASS`           | —       | alert email transport (existing)                          |
| `TIP_ALERT_BASELINE_RUNS`            | 30      | alerting                                                  |
| `TIP_ALERT_MIN_BASELINE_RUNS`        | 5       | alerting (cold start)                                     |
| `TIP_ALERT_MAD_MULTIPLIER`           | 4       | alerting                                                  |
| `TIP_ALERT_RATIO_MULTIPLIER`         | 3       | alerting                                                  |
| `TIP_ALERT_COUNT_FLOOR`              | 5       | alerting                                                  |
| `TIP_ALERT_MAGNITUDE_FLOOR_XLM`      | 100     | alerting                                                  |
| `TIP_ALERT_SINGLE_CORRECTION_XLM`    | 500     | alerting                                                  |
| `TIP_ALERT_COLD_START_COUNT`         | 25      | alerting                                                  |
| `TIP_ALERT_COLD_START_MAGNITUDE_XLM` | 1000    | alerting                                                  |
| `TIP_ALERT_COOLDOWN_HOURS`           | 6       | alerting                                                  |

## Deployment

Migrations are run manually with `psql -f` (outside a transaction: `_03` and
`_04` manage their own transactions and `_04` uses `CREATE INDEX CONCURRENTLY`).
All of them are idempotent.

The application code reads the new tables and `users.deleted_at`, so the
schema migrations go first; the JSONB constraints go last because they need
the audit, which runs through the deployed application.

1. `20260925_01_job_infrastructure.sql`
2. `20260925_02_jsonb_contract_functions.sql`
3. `20260925_04_user_tombstones.sql`
4. `20260925_05_mux_reconciliation.sql`
5. `20260925_06_tip_reconciliation_alerting.sql`
6. Set `CRON_SECRET` and `RECONCILIATION_ALERT_EMAILS`, then deploy the application.
7. Run the JSONB audit (`GET /api/admin/jsonb-audit`, page through `nextCursor`),
   apply `normalize`, review the `nonconforming` and `legacy` findings, and
   `quarantine` whatever is still `invalid`.
8. `20260925_03_jsonb_contract_constraints.sql` — refuses to run while any row is invalid.

`db/tests/data-integrity.test.sql` checks the database side (constraints, the
purge function, foreign-key policy, finding upserts, correction idempotency)
against a disposable database with all migrations applied; it runs in a
transaction and rolls back:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/data-integrity.test.sql
```
