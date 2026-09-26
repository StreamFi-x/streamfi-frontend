-- Heavy read mix: admin analytics (Q11) + viewer-geo aggregate (Q12) for a random heavy channel.
\set channel 100 * random(1, 50)
SELECT
  (SELECT COUNT(*) FROM users WHERE is_banned = false)            AS total_users,
  (SELECT COUNT(*) FROM users WHERE is_live = true)               AS live_now,
  (SELECT COUNT(*) FROM stream_reports WHERE status = 'pending')  AS pending_stream_reports,
  (SELECT COUNT(*) FROM bug_reports    WHERE status = 'pending')  AS pending_bug_reports,
  (SELECT COUNT(*) FROM users
    WHERE created_at > now() - INTERVAL '7 days')                AS new_users_7d,
  (SELECT COUNT(*) FROM stream_categories)                        AS total_categories;
SELECT sv.country AS country,
       COUNT(DISTINCT COALESCE(sv.user_id::text, sv.session_id))::int AS viewer_count
FROM stream_viewers sv
JOIN stream_sessions ss ON ss.id = sv.stream_session_id
WHERE ss.user_id = sfperf.uid(:channel)
  AND sv.joined_at >= NOW() - ('30'::text || ' days')::interval
GROUP BY sv.country
ORDER BY viewer_count DESC;
