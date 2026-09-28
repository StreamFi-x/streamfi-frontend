-- migrate:no-transaction
-- Hot-path indexes for case-insensitive lookups and keyset pagination
-- (issues #1415, #1414). Evidence: docs/database/query-performance.md and the
-- lab in scripts/perf (EXPLAIN ANALYZE, warm cache, synthetic data). Timings
-- below are "before -> after" execution ms for the worst-case parameters in
-- scripts/perf/hot-queries.sql.
--
-- CONCURRENTLY does not block writes while building, so the runner applies
-- this file statement by statement (directive above). Every statement is
-- rerunnable. If a build is interrupted it leaves an INVALID index that
-- IF NOT EXISTS would then skip: drop it, then
--   npm run db:migrate -- resolve 20260926100200_hot_path_indexes --rolled-back
-- and rerun `up`. Find invalid indexes with:
--   SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE NOT i.indisvalid;
--
-- ORDER MATTERS: every replacement exists before the index it makes redundant
-- is dropped, so no query loses its access path mid-migration. Keep the DROP
-- section last.
--
-- ALREADY COVERED BY 20260925190000_chat_poll_indexes (not repeated here):
--   idx_users_mux_playback_id, idx_stream_sessions_open_by_user and
--   idx_chat_messages_session_window. A (stream_session_id, created_at DESC,
--   id DESC) keyset index was measured against the window index and rejected:
--   the planner derives `created_at <=` from the (created_at, id) cursor and
--   deep history pages read the same number of buffers (171 vs 164).
--
-- REJECTED (measured, not added)
--   users (current_viewers DESC) WHERE is_live for streams/live: page 1
--     4.5 -> 0.5 ms, no gain on deep pages; it turned current_viewers UPDATEs
--     from ~96% HOT to 0% HOT, ~3x WAL per update (481 -> 1531 bytes).
--   users (is_banned) for the admin total-users count: 51 -> 28 ms only via an
--     index-only scan on an all-visible heap; 99% of rows match; admin-only and
--     now served by the read replica behind a 30s shared cache.
--   Partial stream_recordings keyset WHERE status = 'ready': recordings/[wallet]
--     lists every status, so the plain keyset index below serves both routes.
--
-- NOT TOUCHED: idx_users_is_live. db/schema.sql and scripts/optimize-database.sql
--   define it differently under IF NOT EXISTS, so production's definition is
--   unknown. Check with
--     SELECT indexdef FROM pg_indexes WHERE indexname IN ('idx_users_username', 'idx_users_is_live');

-- users: LOWER(username) = LOWER($1) (~30 sites: users/[username], clips, recordings, whitelist, follow). 58.6 -> 0.09 ms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
-- users: LOWER(wallet) = LOWER($1) (streams/create, privacy, playback-token, recordings/[wallet]). 79.3 -> 0.06 ms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_wallet_lower ON users (LOWER(wallet));
-- users: LOWER(email) = LOWER($1) (auth/session). No-match path 157.9 -> 0.07 ms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
-- stream_clips: global ready-clips keyset (streams/clips GET). 53.7 -> 3.8 ms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_clips_ready_keyset ON stream_clips (created_at DESC, id DESC) WHERE status = 'ready';
-- stream_clips: per-streamer ready-clips keyset (streams/clips GET ?username=). 70.7 -> 10.6 ms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_clips_streamer_ready_keyset ON stream_clips (streamer_id, created_at DESC, id DESC) WHERE status = 'ready';
-- stream_recordings: per-user keyset (streams/recordings GET ?username=, recordings/[wallet]). 89.3 -> 12.2 ms for the owner list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_recordings_user_keyset ON stream_recordings (user_id, created_at DESC, id DESC);
-- stream_whitelist: streamer's whitelist keyset (streams/whitelist GET). 9.5 -> 1.0 ms for a 5k-entry streamer
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_whitelist_streamer_keyset ON stream_whitelist (streamer_id, created_at DESC, id DESC);

-- CONCURRENTLY builds do not gather statistics for expression indexes; without
-- this the planner keeps guessing 0.5% selectivity for LOWER(col) = $1.
ANALYZE users;

-- Redundant indexes (drop only after the replacements above exist)
-- (stream_session_id) WHERE NOT is_deleted: left prefix of idx_chat_messages_session_window. 72 MB in the lab; one fewer index on every chat insert.
DROP INDEX CONCURRENTLY IF EXISTS idx_chat_messages_not_deleted;
-- Duplicate of the UNIQUE(username) index users_username_key, or, where scripts/optimize-database.sql built it on LOWER(username), of idx_users_username_lower.
DROP INDEX CONCURRENTLY IF EXISTS idx_users_username;
-- Duplicate of the UNIQUE(wallet) index users_wallet_key. 22 MB in the lab.
DROP INDEX CONCURRENTLY IF EXISTS idx_users_wallet;
-- Left prefix of idx_stream_recordings_user_keyset (also serves the ON DELETE CASCADE lookups).
DROP INDEX CONCURRENTLY IF EXISTS idx_stream_recordings_user_id;
-- Left prefix of UNIQUE(streamer_id, user_id), UNIQUE(streamer_id, identifier) and idx_stream_whitelist_streamer_keyset.
DROP INDEX CONCURRENTLY IF EXISTS idx_stream_whitelist_streamer;
