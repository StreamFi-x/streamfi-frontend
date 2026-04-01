CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stream_categories_title_trgm
  ON stream_categories USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_creator_stream_title_trgm
  ON users USING gin ((COALESCE(creator->>'streamTitle', '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_creator_category_trgm
  ON users USING gin ((COALESCE(creator->>'category', '')) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS gifts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  usd_value NUMERIC(10, 2) NOT NULL,
  sort_order INT NOT NULL,
  animation TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gifts_name_unique ON gifts (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_gifts_active_sort ON gifts (active, sort_order);

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

INSERT INTO gifts (name, emoji, usd_value, sort_order, animation)
VALUES
  ('Flower', '🌸', 1.00, 1, 'float'),
  ('Candy', '🍬', 5.00, 2, 'confetti'),
  ('Crown', '👑', 25.00, 3, 'banner'),
  ('Lion', '🦁', 100.00, 4, 'roar'),
  ('Dragon', '🐉', 500.00, 5, 'dragon')
ON CONFLICT DO NOTHING;