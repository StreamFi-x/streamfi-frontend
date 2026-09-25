# Rate limiting

The platform-wide pattern for protecting expensive routes (#1412).

## Where it lives

Per route, through one shared module: `lib/rate-limit.ts`. Middleware was
rejected: `middleware.ts` runs before the session is resolved, and the right
identity for an expensive route is the authenticated user or admin, not the
IP. Middleware also cannot see route-specific state such as "a refresh for
this creator is already running".

```ts
const limiter = createRateLimit({
  namespace: "my-route",
  limit: 30,
  windowMs: 60_000,
});

const result = await limiter.check(identity); // server-derived identity
if (!result.success) return tooManyRequests(result);
```

- **Store:** Upstash Redis sliding window (`@upstash/ratelimit`), shared by
  every instance. Each limiter gets its own key prefix
  (`ratelimit:<namespace>`), so routes never share counters.
- **Identity:** the caller passes it. Use the session `userId` or the admin's
  Privy ID when there is one. IP is only for anonymous routes (for example
  chat POST). Identities always come from `verifySession` or
  `currentAdminPrivyId` (after `requireAdminSession`), never from the request body.
- **429:** `tooManyRequests()` returns `{ error, retryAfter }` (the API's
  usual `{ error }` shape) with `Retry-After`, `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset` and `Cache-Control: private,
no-store`. No Redis details are exposed.
- **Mutual exclusion:** `lib/single-flight-lock.ts` provides
  `acquireLock(name, { ttlMs })` for work that must not overlap. It uses
  `SET NX PX` with a random token, and releases through a compare-and-delete
  script, so a holder whose TTL lapsed cannot release a newer holder's lock.

The older `createRateLimiter(windowMs, max)` boolean API is kept. It now runs
on the same implementation, so its ~35 existing callers get the failure
behaviour below as well.

## When Redis fails

Decision: **degrade to a per-instance memory limiter**. Neither fail-open nor
fail-closed.

| Option               | Upstash outage effect                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Fail open            | No protection at all during the outage, exactly when retries spike                                  |
| Fail closed          | Admin dashboard and tip refresh return 503 for the whole outage                                     |
| **Degrade (chosen)** | Limits still apply per instance, so worst case is limit × instances. Nothing legitimate is blocked. |

Upstash calls time out after 1s. `@upstash/ratelimit`'s own timeout returns
`success: true` (fail-open); that response is detected (`reason: "timeout"`)
and treated as a failure. The lock uses the same policy. Degraded decisions
are logged with the namespace.

## Admin analytics: `GET /api/admin/analytics`

- The route is admin-only (`ADMIN_PRIVY_IDS`), behind the brute-force guard `requireAdminSession` from #1396.
- **30 requests per minute per admin.** The dashboard polls every 30s
  (`hooks/admin/useAdminAnalytics.ts`), which is 2/min per tab. 30 allows
  several tabs plus manual refreshes, and stops a runaway refresh loop within
  a minute. Admins are limited independently of one another.
- The six `COUNT` scans are also cached for 30s in Redis, shared by all
  admins (`adminAggregate` in `docs/caching-policy.md`). However many admins
  poll, the scans run at most about twice a minute. The response is
  `private, no-store`.

## Tip refresh: `POST /api/tips/refresh-total`

The recalculation itself is `reconcileUserTipTotals`
(`lib/stellar/tip-reconciliation.ts`, from #1400), shared with the scheduled
reconciliation job. It walks the creator's whole Horizon history (at most 100
pages, otherwise `422`), records tips in batches, and writes totals behind a
version check: a concurrent writer makes it retry, and after three retries the
route returns `409`. That keeps concurrent refreshes _correct_. It does not
stop repeated or overlapping refreshes from each doing the full walk. The
route was also unauthenticated and trusted the `username` in the body. It now
has four guards in front of the reconcile.

1. **Authentication and ownership.** A session is required, and the caller
   must own the creator or be an admin. The refresh button only appears on
   the owner's dashboard.
2. **Per caller: 10 refreshes per 10 minutes** (`tips-refresh:caller`, keyed
   by session user id). Otherwise `429` with `Retry-After`.
3. **Per creator cooldown: 1 per minute** (`tips-refresh:creator`). A repeat
   inside the minute returns the totals already stored, with
   `refreshed: false` and `retryAfter`, instead of walking Horizon again. That
   is the "already complete" case.
4. **Per creator lock** (`tips-refresh:<creatorId>`, 5-minute TTL). A request
   that gets past the cooldown while a previous walk is still running gets
   `409` with `Retry-After: 10`. A count-based limit alone cannot prevent
   this: a long walk outlives the cooldown window. The TTL frees the lock if
   an invocation is killed mid-walk.

After a successful reconcile, `reconcileUserTipTotals` invalidates the
creator's profile and stats caches (the scheduled job gets this too), and
the dashboard counter uses the response directly instead of refetching.

## Tests

- `lib/__tests__/rate-limit.test.ts`: normal use, bursts, window reset,
  identity isolation, the 429 shape, namespacing, Upstash errors and timeouts
  degrading.
- `lib/__tests__/single-flight-lock.test.ts`: exclusivity under concurrency,
  expiry, stale-holder release, Redis `SET NX PX` and token release, and the
  Redis failure fallback.
- `app/api/admin/analytics/__tests__/route.test.ts`: auth, the dashboard
  pattern passing, a loop getting 429, admin isolation, recovery, the shared
  aggregate cache.
- `app/api/tips/refresh-total/__tests__/route.test.ts`: 401/400/403/404,
  owner/admin, reconcile arguments and response shape, stale (409),
  oversized history (422), cooldown reuse, overlapping refresh (409),
  per-caller 429, caller isolation, lock released on failure.
