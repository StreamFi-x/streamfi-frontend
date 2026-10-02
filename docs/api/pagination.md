# List pagination contract

Every list endpoint that can grow without bound uses cursor (keyset) pagination
with this contract. Server helpers live in `lib/pagination/cursor.ts`. The
client hook is `hooks/useCursorPagination.ts`.

## Request

| Param    | Meaning                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `limit`  | Page size. Optional; each endpoint has a default and a maximum (table below). Values above the maximum are clamped to it. |
| `cursor` | Opaque string from the previous response's `nextCursor`. Omit it for the first page.                                      |

Validation, all returning `400 { "error": "..." }` without touching the database:

- `limit` must be a positive integer (`abc`, `0`, `-1`, `1.5`, and empty are rejected).
- `cursor` must be a cursor this API issued. Malformed, truncated, or edited cursors are rejected.
- `offset` is rejected on every endpoint using this contract, so old clients fail loudly instead of silently re-reading page one.

## Response

```json
{
  "items": [ ... ],
  "nextCursor": "eyJ2IjoxLCJ0IjoiMjAyNi0wOS0yNVQxMDowMDowMC4xMjM0NTZaIiwiaSI6Ii4uLiJ9",
  "hasMore": true
}
```

- `items` are newest first (`created_at DESC, id DESC`).
- `hasMore` is true when another page exists. `nextCursor` is then non-null.
- At the end of the list, `hasMore` is false and `nextCursor` is null.
- An empty list returns `{ "items": [], "nextCursor": null, "hasMore": false }`.
- Endpoints may add fields alongside these three (notifications add `unreadCount`).

## Ordering and why it is safe under concurrent writes

Every paginated query is:

```sql
WHERE <endpoint filters>
  AND (x.created_at, x.id) < ($cursor_ts::timestamptz, $cursor_id::uuid)
ORDER BY x.created_at DESC, x.id DESC
LIMIT $limit + 1
```

- **Total order.** `id` breaks ties between rows that share a `created_at`,
  which happens constantly in chat. Paging on `created_at` alone skips or
  repeats tied rows at page boundaries.
- **Insert-stable.** The cursor is a position in the ordering, not a row
  count. Rows inserted while a client pages are newer than every cursor it
  holds, so they never shift into a later page. OFFSET pagination repeats a
  row for every insert that lands between two requests.
- **Microsecond precision.** Postgres stores microseconds, while a JS `Date`
  keeps milliseconds. The cursor timestamp is therefore selected as text
  (`to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts`) and never
  round-trips through a `Date`. Otherwise rows within the same millisecond
  would be skipped.
- **First page.** Uses sentinel bounds (`'infinity'`,
  `ffffffff-ffff-ffff-ffff-ffffffffffff`), so every page runs one query shape
  and one plan.
- **`LIMIT + 1`.** Fetches one extra row to learn whether another page exists,
  so no `COUNT(*)` is needed. The old clips and recordings endpoints ran a
  second COUNT query on every request.
- **Indexes.** Each endpoint has an index matching its filter and ordering:
  `idx_chat_messages_session_window` (from
  `20260925190000_chat_poll_indexes.sql`; the planner turns the row comparison
  into an index condition on `created_at`), plus the clips, recordings and
  whitelist keyset indexes in `20260926100200_hot_path_indexes.sql` and the
  notifications indexes in `20260926100000_create_notifications_table.sql`.
  Measurements are in `docs/database/query-performance.md`. Real-Postgres
  coverage (ties, 1µs neighbours, concurrent inserts) is in
  `__tests__/lib/pagination/keyset.db.test.ts`.
- **Keyset columns.** Rows with a NULL `created_at` do not satisfy the
  comparison and are excluded. All current writers set `created_at`.

## Cursor format

`base64url(JSON.stringify({ v: 1, t: "<created_at, UTC, microseconds>", i: "<uuid>" }))`

Clients must treat it as opaque. The server validates the version, the
timestamp (format and calendar validity), and the uuid before using it. Values
are passed as bind parameters, never interpolated.

The cursor is not signed. It only encodes a position, and every endpoint
applies its authorization and ownership filters from the session, never from
the cursor. A forged cursor can move within the caller's own list, which the
caller can already read, but cannot widen it. If a future cursor carries
filter state, sign it or bump `v`.

## Endpoints

| Endpoint                                | Default | Max | Filters (from)                        | Notes                                                                                                                                                                                                        |
| --------------------------------------- | ------- | --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/streams/chat?playbackId=`     | 50      | 200 | current live session of `playbackId`  | Live view receives pushes (#1450) and re-syncs the first page every 30s (1s polling when push is off; edge- and instance-cached for 1s, `chatWindow`); older history via `nextCursor`. `before` is rejected. |
| `GET /api/streams/clips?username=`      | 20      | 50  | `status = 'ready'`, optional streamer | Was OFFSET + COUNT(\*). No client used it.                                                                                                                                                                   |
| `GET /api/streams/recordings?username=` | 20      | 50  | `status = 'ready'`, optional user     | Was OFFSET + COUNT(\*). Used by the clips page, profile, stream page, explore and home.                                                                                                                      |
| `GET /api/streams/whitelist`            | 50      | 100 | streamer = session user               | Was unbounded. `?streamer=` access check is unchanged.                                                                                                                                                       |
| `GET /api/users/notifications`          | 20      | 50  | user = session user                   | Was the whole `users.notifications` array, sliced in JS. Now a table. Adds `unreadCount`.                                                                                                                    |

### Migration notes for API consumers

| Endpoint      | Before                                       | After                                         |
| ------------- | -------------------------------------------- | --------------------------------------------- |
| chat          | `{ messages }` oldest first; `before` broken | `{ items, nextCursor, hasMore }` newest first |
| clips         | `{ clips, total, hasMore }`, `offset`        | `{ items, nextCursor, hasMore }`, `cursor`    |
| recordings    | `{ recordings, total, hasMore, nextOffset }` | `{ items, nextCursor, hasMore }`              |
| whitelist     | `{ whitelist }` (everything)                 | `{ items, nextCursor, hasMore }`              |
| notifications | `{ notifications, unreadCount }` (latest 50) | `{ items, nextCursor, hasMore, unreadCount }` |

`total` was dropped. Keeping it would mean a `COUNT(*)` on every page, which is
the cost this contract removes. All in-repo clients are updated: `useChat` /
`ChatSection` / `view-stream` (chat and past recordings), the clips page, the
profile page, `ExploreClient`, `PastStreams`, `useStreamWhitelist` /
`WhitelistManager`, and `NotificationBell`.

### The chat bug this replaced

`GET /api/streams/chat?before=` did `parseInt(before)` and compared it with
`cm.id < $before::int`. `chat_messages.id` is a UUID, so any request carrying
`before` failed with a type error. Its ordering was also unrelated to the
filter (`ORDER BY created_at` filtered by `id`) and had no tie-breaker.
`useChat` never sent `before`, which is why this went unnoticed. The UI simply
could not reach history older than the newest 200 messages. `types/chat.ts`
also declared the id as `number`. It is a string.

## Client usage

```ts
const { items, hasMore, loadMore, isLoadingMore, isLoading, error, mutate } =
  useCursorPagination<Recording>(`/api/streams/recordings?username=${u}`, {
    limit: 24,
    getId: r => r.id,
  });
```

- Built on SWR's `useSWRInfinite`, the data layer the app already uses.
  Options such as `refreshInterval` pass through.
- `getId` drops duplicates that can exist briefly while a refreshed first
  page re-keys later pages.
- `initialCursor` starts from a given position. Chat uses it to anchor older
  history at the live window's cursor, so the 1s poll never refetches history
  pages. While history is open, `useChat` keeps the messages that scroll out
  of the 200-message live window, so history, those messages and the window
  stay contiguous. It drops history only if a poll shares no message with the
  previous one: more than 200 new messages arrived within one poll.
- Errors are `PageFetchError` with the HTTP `status` and the API's `error`
  message.

## Endpoints audited and deliberately not migrated

| Endpoint                                  | Current                                             | Why not in this change                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/streams/live`                   | OFFSET, ordered by `current_viewers`                | The sort key changes every few seconds, so a keyset cursor over it is not stable either. A live ranking needs a snapshot or rank-bucket design. Bounded at 50 per page. |
| `GET /api/streams/recordings/[wallet]`    | Unbounded, creator's own list (dashboard)           | Bounded by one creator's recordings. The path segment doubles as a recording id for GET/PATCH/DELETE. Follow-up.                                                        |
| `GET /api/admin/users`, `admin/reports/*` | `page` × 20                                         | Admin UIs use numbered pages. Bounded and admin-only.                                                                                                                   |
| `GET /api/users/top`                      | `limit` only                                        | Top-N leaderboard, not a list to page through.                                                                                                                          |
| `routes-f/follows`, `follow-list-mine`    | Cursor = followee id, compared by `created_at` only | Same tie-skipping bug as the old chat cursor. Follow-up: move to this contract.                                                                                         |
| other `routes-f/*` lists                  | In-memory seed data                                 | No database access.                                                                                                                                                     |
