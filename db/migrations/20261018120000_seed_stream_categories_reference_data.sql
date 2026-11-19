-- Migration: Seed stream_categories reference data with idempotent upsert
-- Treats stream_categories as reference data distinct from schema definitions

INSERT INTO stream_categories (title, description, tags) VALUES
('Gaming', 'Video game streaming and gameplay', ARRAY['gaming', 'esports', 'gameplay']),
('Technology', 'Tech talks, coding, and development', ARRAY['coding', 'programming', 'tech']),
('Education', 'Educational content and tutorials', ARRAY['learning', 'tutorial', 'education']),
('Entertainment', 'General entertainment content', ARRAY['entertainment', 'variety', 'fun']),
('Music', 'Live music and audio content', ARRAY['music', 'audio', 'performance']),
('Art & Design', 'Creative content and design work', ARRAY['art', 'design', 'creative']),
('Business', 'Business discussions and entrepreneurship', ARRAY['business', 'startup', 'entrepreneur']),
('Lifestyle', 'Lifestyle and personal content', ARRAY['lifestyle', 'personal', 'vlog'])
ON CONFLICT (title) DO UPDATE SET
  description = EXCLUDED.description,
  tags = EXCLUDED.tags
WHERE stream_categories.description IS DISTINCT FROM EXCLUDED.description
   OR stream_categories.tags IS DISTINCT FROM EXCLUDED.tags;
