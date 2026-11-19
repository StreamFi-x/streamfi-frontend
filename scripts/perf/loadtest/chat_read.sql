-- S1 viewer poll: streams/chat GET = active-session lookup (Q2) + NEW keyset first page (Q1b).
-- Random one of the 20 hot live sessions (users 100..2000 step 100).
\set streamer 100 * random(1, 20)
SELECT ss.id AS sid
FROM users u
JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
WHERE u.mux_playback_id = sfperf.playback(:streamer)
ORDER BY ss.started_at DESC
LIMIT 1 \gset
SELECT cm.id, cm.content, cm.message_type, cm.created_at, u.username, u.wallet, u.avatar
FROM chat_messages cm JOIN users u ON cm.user_id = u.id
WHERE cm.stream_session_id = :sid AND cm.is_deleted = false
  AND (cm.created_at, cm.id) < ('infinity'::timestamptz, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
ORDER BY cm.created_at DESC, cm.id DESC LIMIT 201;
