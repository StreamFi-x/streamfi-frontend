-- Migration: Add explicit ON DELETE actions to foreign keys referencing users
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_moderated_by_fkey,
  ADD CONSTRAINT chat_messages_moderated_by_fkey
    FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE watch_history
  DROP CONSTRAINT IF EXISTS watch_history_streamer_id_fkey,
  ADD CONSTRAINT watch_history_streamer_id_fkey
    FOREIGN KEY (streamer_id) REFERENCES users(id) ON DELETE CASCADE;
