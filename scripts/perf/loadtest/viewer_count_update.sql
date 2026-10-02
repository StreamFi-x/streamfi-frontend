-- users.current_viewers heartbeat-style update on a random live user (write-cost / HOT test).
\set streamer 100 * random(1, 2000)
UPDATE users SET current_viewers = current_viewers + 1 WHERE id = sfperf.uid(:streamer);
