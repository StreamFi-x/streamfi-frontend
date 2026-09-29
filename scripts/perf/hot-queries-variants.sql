-- Follow-up EXPLAINs for candidates whose benefit depends on query shape.
-- Run via: scripts/perf/run-explain.sh <label> scripts/perf/hot-queries-variants.sql
\set ON_ERROR_STOP on
\pset pager off
SELECT sfperf.uid(100) AS heavy_user, lower(sfperf.uname(100)) AS heavy_username_input \gset

\echo ### Q6c clips NEW keyset filtered, streamer resolved by scalar subquery
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, c.playback_id, c.mux_asset_id,
       c.start_offset, c.duration, c.view_count, c.status, c.created_at,
       clipper.username AS clipped_by_username, clipper.avatar AS clipped_by_avatar,
       streamer.username AS streamer_username
FROM stream_clips c
JOIN users clipper  ON clipper.id  = c.clipped_by
JOIN users streamer ON streamer.id = c.streamer_id
WHERE c.status = 'ready'
  AND c.streamer_id = (SELECT id FROM users WHERE LOWER(username) = LOWER(:'heavy_username_input') LIMIT 1)
  AND (c.created_at, c.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY c.created_at DESC, c.id DESC
LIMIT 21;

\echo ### Q7b recordings NEW keyset per user, user resolved by scalar subquery
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT r.id, r.mux_asset_id, r.playback_id, r.title, r.duration, r.created_at, r.status,
       u.username, u.avatar, ss.started_at AS stream_date
FROM stream_recordings r
JOIN users u ON u.id = r.user_id
LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
WHERE r.status = 'ready'
  AND r.user_id = (SELECT id FROM users WHERE LOWER(username) = LOWER(:'heavy_username_input') LIMIT 1)
  AND (r.created_at, r.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY r.created_at DESC, r.id DESC
LIMIT 21;

\echo ### Q11a admin total_users count alone (is_banned = false)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*) FROM users WHERE is_banned = false;

\echo ### Q10b live browse deep page (LIMIT 100 OFFSET 1500)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, username, avatar, mux_playback_id, current_viewers, total_views,
       stream_started_at, creator
FROM users
WHERE is_live = true
  AND COALESCE(stream_privacy, 'public') = 'public'
ORDER BY current_viewers DESC
LIMIT 100 OFFSET 1500;
