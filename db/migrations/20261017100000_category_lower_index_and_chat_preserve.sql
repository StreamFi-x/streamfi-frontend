-- Category lookup LOWER(title) index (#776)
CREATE INDEX IF NOT EXISTS idx_stream_categories_title_lower ON stream_categories (LOWER(title));

-- Preserve chat messages on user deletion/purge (#775)
-- Change foreign key on chat_messages.user_id from CASCADE to SET NULL so chat history is retained for moderation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_user_id_fkey'
  ) THEN
    ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_user_id_fkey;
  END IF;
  ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
END $$;
