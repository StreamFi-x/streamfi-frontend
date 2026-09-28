-- Light write load: streams/chat POST insert + session message counter.
\set sess random(1, 20)
\set sender random(1, 200000)
INSERT INTO chat_messages (user_id, username, stream_session_id, content, message_type, created_at)
VALUES (sfperf.uid(:sender), sfperf.uname(:sender), sfperf.sid(:sess), 'sfperf loadtest message', 'message', CURRENT_TIMESTAMP);
UPDATE stream_sessions SET total_messages = total_messages + 1 WHERE id = sfperf.sid(:sess);
