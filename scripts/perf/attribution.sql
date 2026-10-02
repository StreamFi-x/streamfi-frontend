-- Per-index attribution: re-plan a query with ONE candidate hidden (DROP INDEX inside a
-- transaction that is rolled back), to see what that single index contributes when the
-- other candidates exist. Lab only: DROP INDEX takes an ACCESS EXCLUSIVE lock.
-- Run via: scripts/perf/run-explain.sh attribution scripts/perf/attribution.sql
\set ON_ERROR_STOP on
\pset pager off
SELECT sfperf.playback(100) AS hot_playback, sfperf.uid(100) AS heavy_user,
       lower(sfperf.uname(100)) AS heavy_username_input \gset

\echo ### A1 Q2 without idx_users_mux_playback_id
BEGIN;
DROP INDEX idx_users_mux_playback_id;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ss.id as session_id FROM users u
JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
WHERE u.mux_playback_id = :'hot_playback' ORDER BY ss.started_at DESC LIMIT 1;
ROLLBACK;

\echo ### A2 Q2 without idx_stream_sessions_active_user
BEGIN;
DROP INDEX idx_stream_sessions_active_user;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ss.id as session_id FROM users u
JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
WHERE u.mux_playback_id = :'hot_playback' ORDER BY ss.started_at DESC LIMIT 1;
ROLLBACK;

\echo ### A3 Q6c (subquery form) without idx_stream_clips_streamer_ready_keyset
BEGIN;
DROP INDEX idx_stream_clips_streamer_ready_keyset;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, c.playback_id, c.mux_asset_id, c.start_offset, c.duration, c.view_count,
       c.status, c.created_at, clipper.username, clipper.avatar, streamer.username
FROM stream_clips c
JOIN users clipper  ON clipper.id  = c.clipped_by
JOIN users streamer ON streamer.id = c.streamer_id
WHERE c.status = 'ready'
  AND c.streamer_id = (SELECT id FROM users WHERE LOWER(username) = LOWER(:'heavy_username_input') LIMIT 1)
  AND (c.created_at, c.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY c.created_at DESC, c.id DESC LIMIT 21;
ROLLBACK;

\echo ### A4 Q7b (subquery form) without idx_stream_recordings_user_keyset
BEGIN;
DROP INDEX idx_stream_recordings_user_keyset;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT r.id, r.mux_asset_id, r.playback_id, r.title, r.duration, r.created_at, r.status,
       u.username, u.avatar, ss.started_at AS stream_date
FROM stream_recordings r
JOIN users u ON u.id = r.user_id
LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
WHERE r.status = 'ready'
  AND r.user_id = (SELECT id FROM users WHERE LOWER(username) = LOWER(:'heavy_username_input') LIMIT 1)
  AND (r.created_at, r.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY r.created_at DESC, r.id DESC LIMIT 21;
ROLLBACK;

\echo ### A5 Q8 without idx_stream_whitelist_streamer_keyset
BEGIN;
DROP INDEX idx_stream_whitelist_streamer_keyset;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT sw.id, sw.identifier, sw.created_at, u.username, u.avatar
FROM stream_whitelist sw LEFT JOIN users u ON u.id = sw.user_id
WHERE sw.streamer_id = :'heavy_user'
  AND (sw.created_at, sw.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY sw.created_at DESC, sw.id DESC LIMIT 51;
ROLLBACK;

\echo ### A6 Q7w owner list without idx_stream_recordings_user_id (would the keyset index replace it?)
BEGIN;
DROP INDEX idx_stream_recordings_user_id;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT r.id, r.mux_asset_id, r.playback_id, r.title, r.duration, r.created_at, r.status,
       r.needs_review, ss.started_at AS stream_date
FROM stream_recordings r
JOIN users u ON u.id = r.user_id
LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
WHERE LOWER(u.wallet) = LOWER(sfperf.wallet(100))
ORDER BY r.created_at DESC;
ROLLBACK;
