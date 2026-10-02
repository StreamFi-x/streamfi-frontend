# Caching policy

What StreamFi caches, where, for how long, and what invalidates it (#1411).
The table in `lib/cache/policy.ts` is the source of truth. Change the code
and this page together.

## Layers

| Layer           | Mechanism                                                                        | Invalidation                                               | Used for                                                                                                |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Edge (HTTP/CDN) | `Cache-Control: public, s-maxage=…` on route responses, honoured by Vercel's CDN | TTL, or by tag for policies with `cdnCacheControl` (below) | Public data where a few seconds of staleness is fine; reference data held for a day and purged on write |
| Application     | `cached()` in `lib/cache`: Upstash Redis in production, in-memory in local dev   | Exact, by tag, on write (`lib/cache/invalidation.ts`)      | Public data that must change when it is written                                                         |
| Next data cache | `unstable_cache` in the `[username]` layouts                                     | Same tags, purged via `revalidateTag(tag, { expire: 0 })`  | Page metadata                                                                                           |
| In-process      | `createCache(createMemoryBackend())`                                             | TTL, plus same-instance tag bumps                          | Chat poll window only                                                                                   |
| Browser         | `private, max-age=…`                                                             | TTL                                                        | Per-user data that is safe to reuse briefly                                                             |

Rule of thumb: anything a write must change immediately lives in the
application layer, and the edge in front of it stays short (≤15s total).
Nothing that depends on the caller's session is ever `public`.

## Policies

| Policy             | `Cache-Control`                                                                                                                                    | App TTL                         | Invalidated by                                            | Consistency                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `chatWindow`       | `public, s-maxage=1, stale-while-revalidate=1`                                                                                                     | 1s in-process                   | New message or delete on the same instance                | ≤ ~2s behind; the sender's client overlays its own writes (`lib/chat-recent-writes.ts`)                   |
| `typeahead`        | `public, s-maxage=5`                                                                                                                               | none                            | TTL                                                       | ≤5s                                                                                                       |
| `liveState`        | `public, s-maxage=10, stale-while-revalidate=30`                                                                                                   | none                            | TTL                                                       | ≤40s                                                                                                      |
| `publicProfile`    | `public, s-maxage=5, stale-while-revalidate=10`                                                                                                    | 60s Redis                       | Every write to the user row or their follow edges         | App layer exact; edge adds ≤15s                                                                           |
| `publicListing`    | `public, s-maxage=30, stale-while-revalidate=60`                                                                                                   | none                            | TTL                                                       | ≤90s                                                                                                      |
| `referenceData`    | `public, max-age=0, s-maxage=60, stale-while-revalidate=300`; Vercel CDN: `public, max-age=86400, stale-while-revalidate=604800`, tag `categories` | 1h Redis                        | Category create/update/delete (app layer and CDN, by tag) | Exact at both layers; browsers revalidate every time                                                      |
| `staticAsset`      | `public, s-maxage=86400, stale-while-revalidate=604800`                                                                                            | none                            | TTL (content is derived from immutable IDs)               | ≤1 week                                                                                                   |
| `adminAggregate`   | `private, no-store`                                                                                                                                | 30s Redis, shared by all admins | TTL                                                       | ≤30s; never leaves the server                                                                             |
| `privateAnalytics` | `private, no-cache`                                                                                                                                | none                            | none                                                      | Always revalidated; served by the read replica with read-your-own-writes (docs/database/read-replicas.md) |
| `privateNoStore`   | `private, no-store`                                                                                                                                | none                            | none                                                      | Always fresh                                                                                              |

`current_viewers` sits inside the profile payload but is not invalidated on
every join and leave (`app/api/streams/viewers`); it is bounded by the 60s
app TTL plus the edge window.

## Data categories and where they live

| Category                  | Routes                                                                                                                                | Policy                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| High-churn, shared        | `GET /api/streams/chat`                                                                                                               | `chatWindow`                  |
| Live directory            | `GET /api/streams/live`                                                                                                               | `liveState`                   |
| Public profile, tip stats | `GET /api/users/[username]`, `GET /api/users/[username]/stats`, `app/[username]/layout.tsx`, `app/[username]/watch/layout.tsx`        | `publicProfile`               |
| Public listings           | `GET /api/users/top`, `GET /api/users/[username]/following`, `GET /api/streams/recordings`, `GET /api/streams/clips`                  | `publicListing`               |
| Username search           | `GET /api/search-username`                                                                                                            | `typeahead`                   |
| Low-churn reference       | `GET /api/category`, `GET /api/category/[title]`                                                                                      | `referenceData`               |
| Expensive aggregate       | `GET /api/admin/analytics`                                                                                                            | `adminAggregate`              |
| Per-user analytics        | `routes-f/creator/analytics`, `routes-f/analytics-session-list`, `routes-f/analytics-session-detail`                                  | `privateAnalytics`            |
| Never cached              | `GET /api/users/wallet/[publicKey]` (returns the caller's own email and stream keys), `POST /api/tips/refresh-total`, playback tokens | `privateNoStore` / `no-store` |

## Invalidation

Tags are defined in `lib/cache/tags.ts`:

- `user:name:<lowercased username>` and `user:wallet:<wallet>`. Readers tag by
  the identifier they looked the row up with. Writers call
  `invalidateUserCaches({ id | username | wallet, previousUsername?, previousWallet? })`,
  which resolves any missing identifier from the row and bumps every tag
  (old and new handles on renames).
- `invalidateFollowCaches(followerId, followeeId)` for follow edges, because
  both users' counts change.
- `categories` via `invalidateCategoryCaches()`.

`invalidateTags` also calls `revalidateTag(tag, { expire: 0 })`. On Vercel
that purges every CDN response carrying the same tag in `Vercel-Cache-Tag`
(<https://vercel.com/docs/caching/cdn-cache/purge>), which is what lets
`referenceData` sit at the edge for a day.

Tags are versioned: an entry's key embeds its tags' version counters, read
before the loader runs, and invalidation is an atomic `INCR`. A reader that
loaded stale data before a write stores it under the old version's key,
which nobody reads again. That closes the read/invalidate/write-back race
without locks and makes invalidation O(tags). Version keys outlive any
entry (7 days vs 24h max TTL), so a counter can never reset underneath a
live entry.

### Keeping it enforced

`lib/cache/__tests__/invalidation-coverage.test.ts` scans `app/` and `lib/`
for statements that write `users`, `user_follows` or `stream_categories`. A
file that writes one without calling the matching helper fails the build
unless it is on the allowlist with a written reason. The allowlist is kept
honest too: an entry whose file no longer writes fails.

### Failure behaviour

- A cache backend error is a miss; the loader runs and the request succeeds.
- A failed invalidation is logged. Affected entries are stale until their
  TTL expires, which is why app TTLs stay short for user data.
- Absent results (`null`, 404) are never cached, so a newly registered
  handle is visible at once. Registrations still purge the handle because
  the layouts' `unstable_cache` does cache "not found".
- Without Upstash (local dev) the memory backend clamps TTLs to 30s, because
  invalidation only reaches the instance that performed the write.

## Audit of existing `Cache-Control` headers

| Route                                                 | Before                          | After               | Why                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `routes-f/creator/analytics`                          | `public, s-maxage=300, swr=300` | `privateAnalytics`  | Identity comes from the session cookie and the URL is the same for every creator. The CDN could serve one creator's revenue to another. |
| `routes-f/analytics-session-list`                     | `public, s-maxage=60, swr=300`  | `privateAnalytics`  | Session-authenticated, same reason                                                                                                      |
| `routes-f/analytics-session-detail`                   | `public, s-maxage=300, swr=600` | `privateAnalytics`  | Session-authenticated, same reason                                                                                                      |
| `users/wallet/[publicKey]`                            | `public, s-maxage=60, swr=120`  | `private, no-store` | Returned the whole row (email, stream keys, password and key hashes). Hashes are now stripped; see follow-ups in the PR.                |
| `users/[username]`                                    | `public, s-maxage=60, swr=300`  | `publicProfile`     | Edge window cut from up to 6min to 15s now that the app layer is invalidated on write                                                   |
| `users/[username]/stats`                              | none                            | `publicProfile`     | Now cached in Redis with invalidation                                                                                                   |
| `users/top`                                           | `public, s-maxage=60, swr=120`  | `publicListing`     | Aligned                                                                                                                                 |
| `users/[username]/following`                          | `public, s-maxage=30`           | `publicListing`     | Aligned                                                                                                                                 |
| `streams/live`, `streams/recordings`, `streams/clips` | already matched                 | policy constant     | No behaviour change                                                                                                                     |
| `search-username`                                     | `public, s-maxage=5`            | `typeahead`         | No behaviour change                                                                                                                     |
| `streams/chat` GET                                    | none                            | `chatWindow`        | Collapses per-viewer polling (see `docs/postgres-pooling-and-chat-load.md`)                                                             |
| `admin/analytics`                                     | none                            | `adminAggregate`    | Private; shared 30s server-side cache                                                                                                   |
| `category`, `category/[title]`                        | none                            | `referenceData`     | Cached and invalidated on write                                                                                                         |

Left as they were, and consistent with the policy: `streams/playback/[playbackId]`
(`no-cache, no-store`, signed tokens), `streams/[wallet]` (`private, max-age=10`),
`wallet/balance` (`private, max-age=5`), `routes-f/experiment-assign` and
`routes-f/stream/transcription/[id]/vtt` (`private`), the `routes-f` OG and
placeholder images (`staticAsset` values), `routes-f/sitemap-generate` and
`robots-txt-generate` (public, 6h/1h), and `routes-f/validation-rules`
(public, 1h, static).

`lib/routes-f/cache.ts` (sitemap, earnings) predates this module and has no
invalidation. It is TTL-only by design for those two uses and was left as is.

## Reference data at the edge (#1417)

`stream_categories` (and the tags stored on each category) is read on browse,
discovery and category pages and changes only through the admin panel. It is
cached at every layer and purged by tag the moment it changes.

| Layer              | What                                                                                                           | TTL                                     | Purged by                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Vercel CDN         | Every `GET /api/category*` response (each `?id` / `?title` / `?tag` URL is its own entry), tagged `categories` | 24h, then 7 days stale-while-revalidate | `invalidateCategoryCaches()` → `revalidateTag("categories", { expire: 0 })` |
| Redis (`cached()`) | One entry: the whole table (`lib/reference-data/categories.ts`)                                                | 1h                                      | Same call (version bump)                                                    |
| Browser            | nothing                                                                                                        | `max-age=0`                             | n/a (a purge cannot reach browsers, so they may not keep a copy)            |

- **One entry for the whole table.** It holds a handful of rows. Every
  lookup and search filters it in memory, so the navbar's type-ahead
  (`?title=` on each debounced keystroke) costs no database read, where a
  key per search string would read the table once per prefix.
- **Write paths.** `POST`/`PATCH`/`DELETE /api/category` are the only writers
  (the `db/schema.sql` seed runs before anything is cached).
  `lib/cache/__tests__/invalidation-coverage.test.ts` fails the build if a
  new writer does not call `invalidateCategoryCaches()`. After editing the
  table by hand, purge with `vercel cache invalidate --tag categories`, or
  in the dashboard: CDN → Caches → Purge → Cache Tag.
- **`{ expire: 0 }`, not `'max'`.** The admin page refetches right after
  saving. `'max'` would serve that refetch stale. The cost is one blocking
  refill per region after a write: a single read of a tiny table, written a
  few times a month, so no request coalescing was added.
- **Absent and error responses** (404, 500) carry no CDN directive and are
  not stored.
- `cacheHeaders()` throws if a policy with `cdnCacheControl` is used without
  tags. Nothing could purge such an entry.

**Database reads.** Before this change, every category GET ran two queries:
a leftover debug `SELECT * … LIMIT 1` (removed in PR #1640) plus the real one.
Now:

- a Redis hit costs 0 queries;
- a CDN hit never reaches a function.

`__tests__/lib/reference-data/categories.test.ts` shows 1,000 distinct
type-ahead searches costing one table read, and a write followed by a
fresh read. Production verification was not possible from this change.
After deploy, check:

- `x-vercel-cache: HIT` on `/api/category`;
- `calls` for `FROM stream_categories` in `pg_stat_statements`
  (`scripts/perf/query-audit.sql`), before and after;
- purge propagation time: edit a category, then time how long until
  `GET /api/category?id=<title>` from two regions shows it.
