-- StreamFi perf-lab synthetic data. Run after scripts/perf/schema.sql on an EMPTY database.
--
-- Deterministic: every id is md5(<prefix> || n)::uuid and every random() call runs in one
-- serial session after setseed(0.42), so two loads produce the same rows (timestamps are
-- relative to the load's now()).
--
-- Key shapes (helper functions live in schema sfperf so pgbench scripts can reuse them):
--   users           200k  user n -> id sfperf.uid(n); streamers are n % 5 = 0 (40k, have mux ids)
--                          live users n % 100 = 0 (2k); "heavy" streamers n = 100..5000 step 100 (50)
--                          banned n % 100 = 13 (1%)
--   stream_sessions 1M    s = 1..2000 are the ACTIVE sessions (ended_at NULL) of live user s*100;
--                          s = 1..20 are the hot sessions (heavy streamers 100..2000);
--                          s = 2001..127000 -> 2500 ended sessions for each heavy streamer
--   chat_messages   5M    2M in the 20 hot sessions (100k each) with timestamp ties: every 4
--                          consecutive rows share created_at, and rows 50000..50299 of each hot
--                          session all share ONE created_at (300-row tie, straddles a 201 page);
--                          ~2% is_deleted
--   stream_viewers  4M    1M on the hot sessions, 1M on heavy streamers' ended sessions
--   stream_clips    300k  90k for the 50 heavy streamers; 80% status 'ready'
--   stream_recordings 300k 120k for the 50 heavy streamers; 80% 'ready'
--   stream_whitelist 150k  heavy streamers 100..2000 have 5000 entries each
--   notifications   3M    heavy users 100..5000 have 20k each (10% unread)
--
-- Row-count knobs (psql -v name=value). Defaults are the full-scale targets above; the
-- reference run used the REDUCED values listed in README.md because host disk ran low.
--   chat_ended_rows    (2000000)  chat rows spread over ended sessions
--   viewers_rows       (4000000)  1/4 hot sessions, 1/4 heavy streamers' ended sessions, 1/2 random
--   clips_rows         (300000)   30% on heavy streamers
--   recordings_rows    (300000)   40% on heavy streamers
--   notif_heavy_users  (50)       users 100, 200, ... with 20k notifications each
--   notif_random_rows  (2000000)  notifications spread over all users
--   reports_rows       (50000)    rows in each of stream_reports / bug_reports
--   skip_core          (unset)    set to 1 to skip users/stream_sessions/chat (a),(b) when resuming
\set ON_ERROR_STOP on
\if :{?chat_ended_rows}   \else \set chat_ended_rows 2000000 \endif
\if :{?viewers_rows}      \else \set viewers_rows 4000000 \endif
\if :{?clips_rows}        \else \set clips_rows 300000 \endif
\if :{?recordings_rows}   \else \set recordings_rows 300000 \endif
\if :{?notif_heavy_users} \else \set notif_heavy_users 50 \endif
\if :{?notif_random_rows} \else \set notif_random_rows 2000000 \endif
\if :{?reports_rows}      \else \set reports_rows 50000 \endif
\timing on
SET max_parallel_workers_per_gather = 0;   -- keep random() sequence deterministic
SET synchronous_commit = off;
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';

CREATE SCHEMA IF NOT EXISTS sfperf;
CREATE OR REPLACE FUNCTION sfperf.uid(i int) RETURNS uuid
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT md5('u' || i)::uuid $$;
CREATE OR REPLACE FUNCTION sfperf.sid(s int) RETURNS uuid
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT md5('s' || s)::uuid $$;
CREATE OR REPLACE FUNCTION sfperf.uname(i int) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE i % 4 WHEN 0 THEN 'Streamer_' WHEN 1 THEN 'gamer' WHEN 2 THEN 'CoolCat' ELSE 'XO_Pro' END || i $$;
-- Stellar-like public key: 'G' + 55 base32 chars (A-Z2-7), uppercase.
CREATE OR REPLACE FUNCTION sfperf.wallet(i int) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 'G' || upper(translate(substr(md5('w' || i) || md5('x' || i), 1, 55), '0189', 'qrst')) $$;
CREATE OR REPLACE FUNCTION sfperf.playback(i int) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT 'mux' || lpad(i::text, 6, '0') || substr(md5('p' || i), 1, 24) $$;

CREATE TABLE IF NOT EXISTS sfperf.anchor AS SELECT date_trunc('minute', now()) AS t;

SELECT setseed(0.42);

\if :{?skip_core}
\echo 'skip_core set: users, stream_sessions, chat (a)/(b) assumed loaded'
\else
-- ---------------------------------------------------------------- users
INSERT INTO users (id, wallet, username, email, avatar, bio, created_at, updated_at,
                   mux_stream_id, mux_playback_id, mux_stream_key, is_live, current_viewers,
                   total_views, stream_started_at, creator, stream_privacy, is_banned, banned_at,
                   privy_id, enable_recording)
SELECT sfperf.uid(i),
       sfperf.wallet(i),
       sfperf.uname(i),
       CASE WHEN i % 10 = 9 THEN NULL
            WHEN i % 10 = 3 THEN 'User' || i || '@Example.COM'
            ELSE 'user' || i || '@example.com' END,
       'https://cdn.example.com/avatars/' || i || '.png',
       CASE WHEN i % 3 = 0 THEN 'bio of user ' || i END,
       a.t - random() * interval '730 days',
       a.t - random() * interval '30 days',
       CASE WHEN i % 5 = 0 THEN 'ms_' || i END,
       CASE WHEN i % 5 = 0 THEN sfperf.playback(i) END,
       CASE WHEN i % 5 = 0 THEN 'sk_' || md5('k' || i) END,
       i % 100 = 0,
       CASE WHEN i % 100 = 0 AND i <= 5000 THEN 5000 + floor(random() * 20000)::int
            WHEN i % 100 = 0 THEN floor(power(random(), 3) * 2000)::int
            ELSE 0 END,
       floor(random() * 100000)::int,
       CASE WHEN i % 100 = 0 THEN a.t - random() * interval '6 hours' END,
       CASE WHEN i % 5 = 0 THEN jsonb_build_object('streamTitle', 'Stream ' || i, 'category', 'Gaming',
                                                   'tags', jsonb_build_array('fun', 'live'))
            ELSE '{}'::jsonb END,
       (ARRAY['public','public','public','public','public','public','public','public','public','public',
              'public','public','public','public','public','public','public','unlisted','subscribers_only',NULL])
         [1 + floor(random() * 20)::int],
       i % 100 = 13,
       CASE WHEN i % 100 = 13 THEN a.t - random() * interval '90 days' END,
       CASE WHEN i % 4 = 1 THEN 'did:privy:' || i END,
       i % 5 = 0
FROM generate_series(1, 200000) i, sfperf.anchor a;

-- ---------------------------------------------------------------- stream_sessions
INSERT INTO stream_sessions (id, user_id, mux_session_id, title, playback_id, started_at, ended_at,
                             peak_viewers, total_unique_viewers, total_messages, created_at)
SELECT sfperf.sid(s), sfperf.uid(ui), 'mxs_' || s, 'Session ' || s, sfperf.playback(ui),
       st, en,
       floor(random() * 5000)::int, floor(random() * 20000)::int, 0, st
FROM (
  SELECT s, ui, st,
         CASE WHEN s <= 2000 THEN NULL ELSE st + interval '30 minutes' + random() * interval '210 minutes' END AS en
  FROM (
    SELECT s,
           CASE WHEN s <= 2000   THEN s * 100
                WHEN s <= 127000 THEN ((s - 2001) % 50 + 1) * 100
                ELSE ((s % 40000) + 1) * 5 END AS ui,
           CASE WHEN s <= 20   THEN a.t - interval '6 hours'
                WHEN s <= 2000 THEN a.t - ((s % 360) + 1) * interval '1 minute'
                ELSE a.t - interval '1 day' - random() * interval '729 days' END AS st
    FROM generate_series(1, 1000000) s, sfperf.anchor a
  ) x
) y;

-- ---------------------------------------------------------------- chat_messages
-- (a) 20 hot sessions x 100k, timestamp ties (groups of 4 + one 300-row tie per session)
INSERT INTO chat_messages (id, user_id, username, stream_session_id, content, message_type,
                           is_deleted, is_moderated, created_at)
SELECT md5('c' || n)::uuid, sfperf.uid(ui), sfperf.uname(ui), sfperf.sid(sess),
       'message ' || n || ' ' || (ARRAY['gg','lol','nice play','hello from Lagos','W stream','first time here, love it','pog','can you explain that again?'])[1 + n % 8],
       CASE WHEN n % 100 = 0 THEN 'system' WHEN n % 50 = 1 THEN 'emote' ELSE 'message' END,
       n % 50 = 0, n % 50 = 0,
       a.t - interval '6 hours'
         + (CASE WHEN j BETWEEN 50000 AND 50299 THEN 12500 ELSE j / 4 END) * interval '400 milliseconds'
FROM (
  SELECT n, (n - 1) / 100000 + 1 AS sess, (n - 1) % 100000 AS j, 1 + floor(random() * 200000)::int AS ui
  FROM generate_series(1, 2000000) n
) x, sfperf.anchor a;

-- (b) 1M spread over the other 1980 active sessions
INSERT INTO chat_messages (id, user_id, username, stream_session_id, content, message_type,
                           is_deleted, is_moderated, created_at)
SELECT md5('c' || n)::uuid, sfperf.uid(ui), sfperf.uname(ui), sfperf.sid(sess),
       'message ' || n || ' ' || (ARRAY['gg','lol','nice play','hi','W','hello chat','pog','??'])[1 + n % 8],
       CASE WHEN n % 100 = 0 THEN 'system' WHEN n % 50 = 1 THEN 'emote' ELSE 'message' END,
       n % 50 = 0, n % 50 = 0,
       a.t - random() * (((sess % 360) + 1) * interval '1 minute')
FROM (
  SELECT n, 21 + (n % 1980) AS sess, 1 + floor(random() * 200000)::int AS ui
  FROM generate_series(2000001, 3000000) n
) x, sfperf.anchor a;
\endif

-- (c) chat_ended_rows over ended sessions (inside each session's time window)
INSERT INTO chat_messages (id, user_id, username, stream_session_id, content, message_type,
                           is_deleted, is_moderated, created_at)
SELECT md5('c' || n)::uuid, sfperf.uid(ui), sfperf.uname(ui), ss.id,
       'message ' || n || ' ' || (ARRAY['gg','lol','nice','hi','W','hello chat','pog','??'])[1 + n % 8],
       CASE WHEN n % 100 = 0 THEN 'system' WHEN n % 50 = 1 THEN 'emote' ELSE 'message' END,
       n % 50 = 0, n % 50 = 0,
       ss.started_at + r * (ss.ended_at - ss.started_at)
FROM (
  SELECT n, 2001 + floor(random() * 998000)::int AS sess, 1 + floor(random() * 200000)::int AS ui, random() AS r
  FROM generate_series(3000001, 3000000 + :chat_ended_rows) n
) x
JOIN stream_sessions ss ON ss.id = sfperf.sid(x.sess);

-- ---------------------------------------------------------------- stream_viewers
INSERT INTO stream_viewers (id, stream_session_id, user_id, session_id, joined_at, left_at,
                            ip_address, country, created_at)
SELECT md5('v' || n)::uuid, ss.id,
       CASE WHEN random() < 0.7 THEN sfperf.uid(1 + floor(random() * 200000)::int) END,
       'v' || n,
       j, j + random() * interval '1 hour',
       CASE WHEN n % 2 = 0 THEN ('10.' || (n % 250) || '.' || (n % 199) || '.' || (n % 97))::inet END,
       (ARRAY['US','US','US','NG','NG','GB','DE','IN','IN','BR','CA','FR','JP','KE','GH','ZA','MX','ES','NL',NULL])
         [1 + floor(random() * 20)::int],
       j
FROM (
  SELECT n, ss.id, CASE WHEN ss.ended_at IS NULL THEN ss.started_at + random() * (a.t - ss.started_at)
                        ELSE ss.started_at + random() * (ss.ended_at - ss.started_at) END AS j
  FROM (
    SELECT n, CASE WHEN n <= :viewers_rows / 4 THEN 1 + n % 20
                   WHEN n <= :viewers_rows / 2 THEN 2001 + n % 125000
                   ELSE 1 + floor(random() * 1000000)::int END AS sess
    FROM generate_series(1, :viewers_rows) n
  ) x
  JOIN stream_sessions ss ON ss.id = sfperf.sid(x.sess)
  CROSS JOIN sfperf.anchor a
) ss;

-- ---------------------------------------------------------------- stream_clips
INSERT INTO stream_clips (id, stream_session_id, clipped_by, streamer_id, title, playback_id,
                          mux_asset_id, start_offset, duration, status, view_count, created_at)
SELECT md5('clip' || n)::uuid, sfperf.sid(2001 + floor(random() * 998000)::int),
       sfperf.uid(1 + floor(random() * 200000)::int),
       sfperf.uid(CASE WHEN n <= :clips_rows * 3 / 10 THEN (n % 50 + 1) * 100 ELSE ((n * 7) % 40000 + 1) * 5 END),
       'Clip ' || n, 'clip_pb_' || n, 'clip_asset_' || n,
       floor(random() * 10000)::int, 1 + floor(random() * 60)::int,
       CASE WHEN n % 20 < 16 THEN 'ready' WHEN n % 20 < 19 THEN 'processing' ELSE 'failed' END,
       floor(random() * 5000)::int,
       a.t - random() * interval '365 days'
FROM generate_series(1, :clips_rows) n, sfperf.anchor a;

-- ---------------------------------------------------------------- stream_recordings
INSERT INTO stream_recordings (id, user_id, stream_session_id, mux_asset_id, playback_id, title,
                               duration, created_at, status, needs_review)
SELECT md5('rec' || n)::uuid,
       sfperf.uid(CASE WHEN n <= :recordings_rows * 4 / 10 THEN (n % 50 + 1) * 100 ELSE ((n * 13) % 40000 + 1) * 5 END),
       sfperf.sid(2001 + floor(random() * 998000)::int),
       'asset_' || n, 'rec_pb_' || n, 'Recording ' || n,
       floor(random() * 14400)::int,
       a.t - random() * interval '730 days',
       CASE WHEN n % 10 < 8 THEN 'ready' WHEN n % 10 = 8 THEN 'processing' ELSE 'errored' END,
       n % 10 = 8
FROM generate_series(1, :recordings_rows) n, sfperf.anchor a;

-- ---------------------------------------------------------------- stream_whitelist
INSERT INTO stream_whitelist (id, streamer_id, user_id, identifier, created_at)
SELECT md5('wl' || n)::uuid, sfperf.uid(si),
       CASE WHEN n % 10 = 0 THEN NULL ELSE sfperf.uid(mi) END,
       CASE WHEN n % 10 = 0 THEN 'pending_' || n ELSE sfperf.uname(mi) END,
       a.t - random() * interval '365 days'
FROM (
  SELECT n,
         CASE WHEN n <= 100000 THEN ((n - 1) / 5000 + 1) * 100
              ELSE ((n - 100001) / 5) * 20 + 5 END AS si,
         CASE WHEN n <= 100000 THEN ((((n - 1) / 5000) * 10007 + ((n - 1) % 5000) * 37) % 200000) + 1
              ELSE ((((n - 100001) / 5) * 7 + ((n - 100001) % 5) * 40009) % 200000) + 1 END AS mi
  FROM generate_series(1, 150000) n
) x, sfperf.anchor a;

-- ---------------------------------------------------------------- notifications
INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at)
SELECT md5('n' || n)::uuid,
       sfperf.uid(CASE WHEN n <= :notif_heavy_users * 20000 THEN ((n - 1) / 20000 + 1) * 100 ELSE 1 + floor(random() * 200000)::int END),
       (ARRAY['follow','tip','live','clip','system'])[1 + n % 5],
       'Notification ' || n,
       CASE WHEN n % 3 = 0 THEN 'Someone did something on your channel (' || n || ')' END,
       CASE WHEN n <= :notif_heavy_users * 20000 THEN n % 10 <> 0 ELSE random() < 0.7 END,
       a.t - random() * interval '365 days'
FROM generate_series(1, :notif_heavy_users * 20000 + :notif_random_rows) n, sfperf.anchor a;

-- ---------------------------------------------------------------- reports
INSERT INTO stream_reports (id, reporter_id, stream_id, streamer, reason, details, status, created_at)
SELECT md5('sr' || n)::uuid, sfperf.uid(1 + n % 200000)::text, sfperf.sid(1 + n % 1000000)::text,
       sfperf.uname(((n % 40000) + 1) * 5), (ARRAY['spam','abuse','nsfw','other'])[1 + n % 4],
       'details ' || n,
       CASE WHEN n % 10 = 0 THEN 'pending' WHEN n % 10 < 7 THEN 'reviewed' ELSE 'dismissed' END,
       a.t - random() * interval '365 days'
FROM generate_series(1, :reports_rows) n, sfperf.anchor a;

INSERT INTO bug_reports (id, reporter_id, category, description, severity, status, created_at)
SELECT md5('br' || n)::uuid, sfperf.uid(1 + n % 200000)::text, (ARRAY['ui','stream','chat','payments'])[1 + n % 4],
       'bug description ' || n, (ARRAY['low','medium','high','critical'])[1 + n % 4],
       CASE WHEN n % 10 = 0 THEN 'pending' WHEN n % 10 < 7 THEN 'reviewed' ELSE 'resolved' END,
       a.t - random() * interval '365 days'
FROM generate_series(1, :reports_rows) n, sfperf.anchor a;

VACUUM (ANALYZE);

SELECT relname AS table, n_live_tup AS rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_size_pretty(pg_relation_size(relid)) AS heap_size,
       pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_stat_user_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;
