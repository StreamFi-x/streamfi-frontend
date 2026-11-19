-- Search Query Analytics Infrastructure
-- Tracks user search behavior to identify zero-result queries, taxonomy gaps, and search quality issues

CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    normalized_query TEXT NOT NULL,  -- Lowercase, trimmed, whitespace normalized for aggregation
    search_source TEXT NOT NULL,      -- 'general', 'category', 'autocomplete'
    result_count INTEGER NOT NULL DEFAULT 0,
    has_results BOOLEAN GENERATED ALWAYS AS (result_count > 0) STORED,
    query_duration_ms INTEGER,        -- Query execution time for performance tracking
    client_ip INET,                   -- For anonymous query tracking
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics queries and aggregation
CREATE INDEX IF NOT EXISTS idx_search_queries_viewer_id ON search_queries(viewer_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_normalized ON search_queries(normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_search_queries_has_results ON search_queries(has_results);
CREATE INDEX IF NOT EXISTS idx_search_queries_source ON search_queries(search_source);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_source ON search_queries(created_at, search_source);

-- Aggregated zero-result queries for reporting
-- Refreshed periodically by cron job for efficient dashboard queries
CREATE TABLE IF NOT EXISTS zero_result_query_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_query TEXT NOT NULL UNIQUE,
    distinct_query_variants TEXT[],   -- Original queries that normalized to this
    total_occurrences INTEGER NOT NULL DEFAULT 1,
    unique_viewers INTEGER NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    trending_score NUMERIC(10, 4) DEFAULT 0,  -- Weight by recency and frequency
    category_context TEXT,            -- Hint: if searches are concentrated in one category
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zero_result_trending ON zero_result_query_aggregates(trending_score DESC, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_zero_result_created_at ON zero_result_query_aggregates(created_at);

-- Retention policy: search queries older than 90 days are automatically deleted
-- (configured via cron job or application-level TTL sweep)

-- Privacy note: viewer_id is set to NULL when user deletes account
-- Search data can be aggregated and anonymized for reporting without user attribution
