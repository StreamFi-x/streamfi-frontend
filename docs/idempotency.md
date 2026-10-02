# Idempotency keys for payment-adjacent routes (#1401)

## Contract

- Protected `POST` routes require an `Idempotency-Key` header: an opaque,
  client-generated value of 8-255 printable ASCII characters. A UUID v4 is
  recommended.
- Generate one key per **logical operation** and send the same key on every
  retry of it (timeouts, flaky networks, double clicks, a page reload
  mid-request). A new operation gets a new key. Server-generated keys would
  defeat deduplication.
- Missing or malformed keys get `400` (`idempotency_key_required` /
  `idempotency_key_invalid`) and nothing runs.
- Responses carry the key back in `Idempotency-Key`. A replayed response also
  carries `Idempotency-Replayed: true`.

| Situation                                 | Response                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| First request                             | Runs the operation; its response is stored                                                                      |
| Retry after it finished (2xx or 4xx)      | Original status and body replayed; nothing runs                                                                 |
| Retry while the original is still running | Waits up to 3 s for it, then `409 idempotency_request_in_progress` + `Retry-After: 1` (retry with the same key) |
| Same key, different request body          | `422 idempotency_key_reused`                                                                                    |
| Original answered 5xx / 429 or threw      | Key released; a retry runs the operation again                                                                  |

## Scope

Keys are unique per `(user_id, scope, idempotency_key)`. `user_id` comes from
the verified session, never from the request body. The same key therefore
cannot collide across users or across operation types, and one user can
never replay another user's response.

| Operation                          | Route                                           | Scope                 | Retention |
| ---------------------------------- | ----------------------------------------------- | --------------------- | --------- |
| Subscription purchase confirmation | `POST /api/routes-f/subscriptions`              | `subscription.create` | 24 h      |
| Subscription renewal confirmation  | `POST /api/routes-f/subscription-renew-confirm` | `subscription.renew`  | 24 h      |
| Payout request                     | `POST /api/routes-f/payouts`                    | `payout.create`       | 7 days    |

To protect another route, add an entry to `IDEMPOTENT_OPERATIONS` in
`lib/idempotency/execute.ts`. Then authenticate and validate the request and
wrap only the side-effecting part in `executeIdempotent`.

## Storage and atomic claim

Keys live in the `idempotency_keys` table. Each row holds the scope, a SHA-256
fingerprint of the validated request (the payload itself is never stored or
logged), the status (`processing` / `completed`), the stored response status
and body, a lease, and timestamps.

- The first request wins by inserting the row
  (`INSERT … ON CONFLICT DO NOTHING` on the unique scope). Concurrent
  duplicates cannot both run the operation.
- The winner holds a 60 s lease. If it crashes, a retry takes over only after
  the lease lapses, through a conditional `UPDATE`, so exactly one retry wins.

## Failure semantics and limits

A database transaction cannot undo an external side effect, so every
operation persists `idempotencyRef` (the id of the claim) alongside what it
creates:

- **Payouts:** `payouts.idempotency_ref` has a unique index. A retry that takes
  over a crashed attempt finds the payout already created and returns it. It
  never inserts a second payout or re-sends emails. Payouts are fulfilled
  manually (`provider = 'manual'`); there is no external provider call to
  deduplicate. Email failures are logged and no longer turn a recorded payout
  into a 500 that invites a retry.
- **Subscriptions:** each subscription records its `idempotency_ref`. A
  `payment_tx_hash` can be used only once, and an already-renewed subscription
  cannot be renewed again. These checks catch duplicates even when a client
  sends a new key. The subscription store is still the in-memory mock; this
  work does not change that.
- This gives at-most-once local processing per key. It is not "exactly once"
  for anything outside the database.
- Two payouts requested with **different** keys are two operations. The route
  subtracts pending payouts from the available balance, but two concurrent
  requests with different keys can still both pass that check.

## Expiry and cleanup

A completed key replays for its retention period (24 h / 7 days). After that
it may start a new operation. A key whose operation may still be running
(status `processing` with a live lease) is never reused or deleted.
`GET /api/routes-f/cron-purge-idempotency-keys` runs daily and deletes expired
keys in batches. It is safe to run repeatedly.

## Client

`hooks/useIdempotentMutation(url, operationId)` generates one key per logical
operation and keeps it in a ref and in `sessionStorage`. Only the key is
stored, never the request. It reuses the key on network errors, 5xx, 429 and
`409 in progress`, and discards it after a final answer. If the server says the
stored key belongs to a different request (`422`), it retries once with a new
key.

There is no UI yet that calls these routes: the Subscribe button and the payout
page do not send requests today. New callers should use this hook.

## Observability

Every step logs a structured `idempotency` event with its `scope`: `claimed`,
`replayed`, `in_flight`, `mismatch`, `recovered`, `released` or
`rejected_key`. Keys, request bodies and responses are never logged.
