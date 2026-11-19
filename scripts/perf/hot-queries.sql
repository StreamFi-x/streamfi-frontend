-- StreamFi hot-path EXPLAIN audit. Run via scripts/perf/run-explain.sh (runs the file 3x and
-- keeps the last run, so every plan below is measured with a warm cache).
--
-- SQL is copied from the route files named on each block; parameters are bound as literals
-- (the app's @vercel/postgres tag sends unnamed parameterised statements -> custom plans).
-- Worst-case parameters: hottest live session (100k msgs), heavy streamer (2500 sessions,
-- 1800 clips, 2400 recordings, 5000 whitelist rows, 20k notifications), deep cursors.
\set ON_ERROR_STOP on
\pset pager off

-- ---------------------------------------------------------------- parameters
SELECT sfperf.sid(1)                AS hot_session,
       sfperf.playback(100)         AS hot_playback,
       sfperf.uid(100)              AS heavy_user,
       lower(sfperf.uname(100))     AS heavy_username_input,   -- 'streamer_100' vs stored 'Streamer_100'
       lower(sfperf.wallet(4242))   AS wallet_input,           -- lower-cased input, stored upper
       'User4242@Example.com'       AS email_input,            -- stored 'user4242@example.com'
       'did:privy:other'            AS privy_input
\gset
SELECT created_at AS chat_deep_ts, id AS chat_deep_id
FROM chat_messages
WHERE stream_session_id = :'hot_session' AND is_deleted = false
ORDER BY created_at DESC, id DESC OFFSET 49800 LIMIT 1
\gset
SELECT created_at AS notif_deep_ts, id AS notif_deep_id
FROM notifications WHERE user_id = :'heavy_user'
ORDER BY created_at DESC, id DESC OFFSET 10000 LIMIT 1
\gset

\echo ### Q1a chat CURRENT (streams/chat GET, no before-branch) LIMIT 200
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT cm.id, cm.content, cm.message_type, cm.created_at, u.username, u.wallet, u.avatar
FROM chat_messages cm
JOIN users u ON cm.user_id = u.id
WHERE cm.stream_session_id = :'hot_session'
  AND cm.is_deleted = false
ORDER BY cm.created_at DESC
LIMIT 200;

\echo ### Q1b chat NEW keyset first page
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT cm.id, cm.content, cm.message_type, cm.created_at, u.username, u.wallet, u.avatar
FROM chat_messages cm JOIN users u ON cm.user_id = u.id
WHERE cm.stream_session_id = :'hot_session' AND cm.is_deleted = false
  AND (cm.created_at, cm.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY cm.created_at DESC, cm.id DESC LIMIT 201;

\echo ### Q1b chat NEW keyset deep cursor (offset ~49800, inside the 300-row timestamp tie)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT cm.id, cm.content, cm.message_type, cm.created_at, u.username, u.wallet, u.avatar
FROM chat_messages cm JOIN users u ON cm.user_id = u.id
WHERE cm.stream_session_id = :'hot_session' AND cm.is_deleted = false
  AND (cm.created_at, cm.id) < (:'chat_deep_ts'::timestamptz, :'chat_deep_id'::uuid)
ORDER BY cm.created_at DESC, cm.id DESC LIMIT 201;

\echo ### Q2 chat active-session lookup (streams/chat GET, every 1s per viewer)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ss.id as session_id
FROM users u
JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
WHERE u.mux_playback_id = :'hot_playback'
ORDER BY ss.started_at DESC
LIMIT 1;

\echo ### Q3 user by LOWER(username) (users/[username] GET; user_follows subqueries omitted)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.id, u.username, u.wallet, u.avatar, u.bio, u.sociallinks, u.emailverified,
       u.emailnotifications, u.creator, u.is_live, u.mux_playback_id, u.latency_mode,
       u.current_viewers, COALESCE(u.stream_access_type, 'public') AS stream_access_type,
       u.stream_started_at, u.total_views, u.total_tips_received, u.total_tips_count,
       u.last_tip_at, u.created_at, u.updated_at,
       (u.stream_password_hash IS NOT NULL) AS is_password_protected
FROM users u
WHERE LOWER(u.username) = LOWER(:'heavy_username_input');

\echo ### Q4 user by LOWER(wallet) (streams/create)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, username, creator, mux_stream_id, enable_recording, latency_mode
FROM users WHERE LOWER(wallet) = LOWER(:'wallet_input');

\echo ### Q5a user by LOWER(email) (auth/session) - existing email
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id FROM users
WHERE LOWER(email) = LOWER(:'email_input')
  AND wallet IS NOT NULL
  AND (privy_id IS NULL OR privy_id != :'privy_input')
LIMIT 1;

\echo ### Q5b user by LOWER(email) (auth/session) - no match, the common first-login path
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id FROM users
WHERE LOWER(email) = LOWER('Brand.New.User@Example.com')
  AND wallet IS NOT NULL
  AND (privy_id IS NULL OR privy_id != :'privy_input')
LIMIT 1;

\echo ### Q6a clips NEW keyset global first page
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, c.playback_id, c.mux_asset_id,
       c.start_offset, c.duration, c.view_count, c.status, c.created_at,
       clipper.username AS clipped_by_username, clipper.avatar AS clipped_by_avatar,
       streamer.username AS streamer_username
FROM stream_clips c
JOIN users clipper  ON clipper.id  = c.clipped_by
JOIN users streamer ON streamer.id = c.streamer_id
WHERE c.status = 'ready'
  AND (c.created_at, c.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY c.created_at DESC, c.id DESC
LIMIT 21;

\echo ### Q6b clips NEW keyset filtered by LOWER(streamer.username) (join form, as route is written)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, c.playback_id, c.mux_asset_id,
       c.start_offset, c.duration, c.view_count, c.status, c.created_at,
       clipper.username AS clipped_by_username, clipper.avatar AS clipped_by_avatar,
       streamer.username AS streamer_username
FROM stream_clips c
JOIN users clipper  ON clipper.id  = c.clipped_by
JOIN users streamer ON streamer.id = c.streamer_id
WHERE c.status = 'ready'
  AND LOWER(streamer.username) = LOWER(:'heavy_username_input')
  AND (c.created_at, c.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY c.created_at DESC, c.id DESC
LIMIT 21;

\echo ### Q7 recordings NEW keyset per user (streams/recordings GET ?username=)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT r.id, r.mux_asset_id, r.playback_id, r.title, r.duration, r.created_at, r.status,
       u.username, u.avatar, ss.started_at AS stream_date
FROM stream_recordings r
JOIN users u ON u.id = r.user_id
LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
WHERE r.status = 'ready'
  AND LOWER(u.username) = LOWER(:'heavy_username_input')
  AND (r.created_at, r.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY r.created_at DESC, r.id DESC
LIMIT 21;

\echo ### Q7w recordings owner list (streams/recordings/[wallet] GET, all statuses, unpaginated)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT r.id, r.mux_asset_id, r.playback_id, r.title, r.duration, r.created_at, r.status,
       r.needs_review, ss.started_at AS stream_date
FROM stream_recordings r
JOIN users u ON u.id = r.user_id
LEFT JOIN stream_sessions ss ON ss.id = r.stream_session_id
WHERE LOWER(u.wallet) = LOWER(sfperf.wallet(100))
ORDER BY r.created_at DESC;

\echo ### Q8 whitelist NEW keyset (streams/whitelist GET, 5000-entry streamer)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT sw.id, sw.identifier, sw.created_at, u.username, u.avatar
FROM stream_whitelist sw
LEFT JOIN users u ON u.id = sw.user_id
WHERE sw.streamer_id = :'heavy_user'
  AND (sw.created_at, sw.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY sw.created_at DESC, sw.id DESC
LIMIT 51;

\echo ### Q9a notifications NEW keyset first page (20k-notification user)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, type, title, body, is_read, created_at
FROM notifications
WHERE user_id = :'heavy_user'
  AND (created_at, id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY created_at DESC, id DESC
LIMIT 21;

\echo ### Q9b notifications NEW keyset deep cursor (offset 10000)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, type, title, body, is_read, created_at
FROM notifications
WHERE user_id = :'heavy_user'
  AND (created_at, id) < (:'notif_deep_ts'::timestamptz, :'notif_deep_id'::uuid)
ORDER BY created_at DESC, id DESC
LIMIT 21;

\echo ### Q9c notifications unread count
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT count(*) FROM notifications WHERE user_id = :'heavy_user' AND is_read = false;

\echo ### Q10a live browse first page (streams/live GET, LIMIT 50 OFFSET 0)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, username, avatar, mux_playback_id, current_viewers, total_views,
       stream_started_at, creator
FROM users
WHERE is_live = true
  AND COALESCE(stream_privacy, 'public') = 'public'
ORDER BY current_viewers DESC
LIMIT 50 OFFSET 0;

\echo ### Q10b live browse deep page (LIMIT 100 OFFSET 1500, personalised fetchLimit)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, username, avatar, mux_playback_id, current_viewers, total_views,
       stream_started_at, creator
FROM users
WHERE is_live = true
  AND COALESCE(stream_privacy, 'public') = 'public'
ORDER BY current_viewers DESC
LIMIT 100 OFFSET 1500;

\echo ### Q11 admin analytics (admin/analytics GET)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  (SELECT COUNT(*) FROM users WHERE is_banned = false)            AS total_users,
  (SELECT COUNT(*) FROM users WHERE is_live = true)               AS live_now,
  (SELECT COUNT(*) FROM stream_reports WHERE status = 'pending')  AS pending_stream_reports,
  (SELECT COUNT(*) FROM bug_reports    WHERE status = 'pending')  AS pending_bug_reports,
  (SELECT COUNT(*) FROM users
    WHERE created_at > now() - INTERVAL '7 days')                AS new_users_7d,
  (SELECT COUNT(*) FROM stream_categories)                        AS total_categories;

\echo ### Q12 viewer geo (routes-f/analytics-viewer-geo, heavy channel, 30 days)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT sv.country AS country,
       COUNT(DISTINCT COALESCE(sv.user_id::text, sv.session_id))::int AS viewer_count
FROM stream_viewers sv
JOIN stream_sessions ss ON ss.id = sv.stream_session_id
WHERE ss.user_id = :'heavy_user'
  AND sv.joined_at >= NOW() - ('30'::text || ' days')::interval
GROUP BY sv.country
ORDER BY viewer_count DESC;
