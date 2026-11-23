-- Keep notification delivery settings in notification_preferences.
-- Clip creation is distinct from a clip being featured.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_clip_created BOOLEAN;

-- Import the legacy clip-created choice once; overlapping live/tip values
-- remain governed by notification_preferences.
-- Legacy user_preferences notification columns remain temporarily for
-- compatibility with old application instances; current code no longer uses them.
INSERT INTO notification_preferences (user_id, notify_clip_created)
SELECT user_id, COALESCE(notify_clips, TRUE)
FROM user_preferences
ON CONFLICT (user_id) DO UPDATE
SET notify_clip_created = COALESCE(
  notification_preferences.notify_clip_created,
  EXCLUDED.notify_clip_created
);

UPDATE notification_preferences
SET notify_clip_created = TRUE
WHERE notify_clip_created IS NULL;

ALTER TABLE notification_preferences
  ALTER COLUMN notify_clip_created SET DEFAULT TRUE,
  ALTER COLUMN notify_clip_created SET NOT NULL;

-- Normalize display-name values to the stable language codes used by settings.
UPDATE user_preferences
SET language = CASE LOWER(language)
  WHEN 'english' THEN 'en'
  WHEN 'spanish' THEN 'es'
  WHEN 'french' THEN 'fr'
  WHEN 'german' THEN 'de'
  WHEN 'portuguese' THEN 'pt'
  WHEN 'russian' THEN 'ru'
  WHEN 'chinese' THEN 'zh'
  WHEN 'japanese' THEN 'ja'
  ELSE language
END
WHERE LOWER(language) IN (
  'english', 'spanish', 'french', 'german',
  'portuguese', 'russian', 'chinese', 'japanese'
);
