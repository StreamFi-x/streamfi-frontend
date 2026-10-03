-- StreamFi ongoing query / index audit. Read-only; safe to run against production.
--   psql "$POSTGRES_URL" -X -f scripts/perf/query-audit.sql
--
-- pg_stat_statements: on Neon it is available but must be enabled per database with
--   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- (the library is already preloaded by Neon; the CREATE EXTENSION needs the owner role).
-- Neon resets its statistics when the compute restarts / scales to zero, so read these
-- numbers as "since the last compute start", not all-time.
\pset pager off
\pset null '(null)'

\echo '== 0. pg_stat_statements availability'
SELECT
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')                    AS extension_installed,
  EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements')            AS extension_available,
  current_setting('shared_preload_libraries', true) ILIKE '%pg_stat_statements%'              AS preloaded;

SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS pgss_on \gset

\if :pgss_on
\echo '== 1a. top 20 statements by total_exec_time'
SELECT round(total_exec_time::numeric, 1)            AS total_ms,
       calls,
       round(mean_exec_time::numeric, 3)             AS mean_ms,
       round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct_total,
       rows,
       shared_blks_hit + shared_blks_read            AS shared_blks,
       round((100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0))::numeric, 1) AS hit_pct,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) AS query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;

\echo '== 1b. top 20 statements by mean_exec_time (calls >= 20)'
SELECT round(mean_exec_time::numeric, 3) AS mean_ms,
       round(max_exec_time::numeric, 1)  AS max_ms,
       round(stddev_exec_time::numeric, 1) AS stddev_ms,
       calls,
       round(total_exec_time::numeric, 1) AS total_ms,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) AS query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND calls >= 20
ORDER BY mean_exec_time DESC
LIMIT 20;

\echo '== 1c. top 20 statements by calls'
SELECT calls,
       round(mean_exec_time::numeric, 3) AS mean_ms,
       round(total_exec_time::numeric, 1) AS total_ms,
       round((rows::numeric / nullif(calls, 0)), 1) AS rows_per_call,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) AS query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY calls DESC
LIMIT 20;
\else
\echo 'pg_stat_statements is not installed in this database: run CREATE EXTENSION IF NOT EXISTS pg_stat_statements; then let traffic accumulate.'
\endif

\echo '== 2. seq-scan-heavy tables (large tables read mostly by sequential scans)'
SELECT relname,
       n_live_tup,
       seq_scan,
       idx_scan,
       seq_tup_read,
       round(seq_tup_read::numeric / nullif(seq_scan, 0)) AS avg_rows_per_seq_scan,
       round((100.0 * seq_scan / nullif(seq_scan + coalesce(idx_scan, 0), 0))::numeric, 1) AS seq_scan_pct,
       pg_size_pretty(pg_relation_size(relid)) AS heap_size
FROM pg_stat_user_tables
WHERE n_live_tup > 10000
ORDER BY seq_tup_read DESC
LIMIT 20;

\echo '== 3. unused indexes (idx_scan = 0, excluding primary keys / unique / constraint-backing indexes)'
SELECT s.relname AS table_name,
       s.indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
       s.idx_scan,
       pg_get_indexdef(s.indexrelid) AS definition
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0
  AND NOT i.indisunique
  AND NOT i.indisprimary
  AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = s.indexrelid)
ORDER BY pg_relation_size(s.indexrelid) DESC;
\echo '   (idx_scan counters are since the last stats reset; check pg_stat_database.stats_reset before dropping anything)'
SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();

\echo '== 4. invalid indexes (e.g. a failed CREATE INDEX CONCURRENTLY) -> DROP INDEX CONCURRENTLY and retry'
SELECT n.nspname AS schema, c.relname AS index_name, t.relname AS table_name,
       i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT i.indisvalid OR NOT i.indisready;

\echo '== 5. index size overview (largest first; compare index vs heap size to spot bloat)'
SELECT s.relname AS table_name,
       s.indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
       pg_size_pretty(pg_relation_size(s.relid)) AS table_heap_size,
       round((pg_relation_size(s.indexrelid)::numeric / nullif(pg_relation_size(s.relid), 0)), 2) AS index_to_heap,
       s.idx_scan,
       s.idx_tup_read
FROM pg_stat_user_indexes s
ORDER BY pg_relation_size(s.indexrelid) DESC
LIMIT 30;

\echo '== 5b. btree leaf density via pgstattuple (only if the extension is installed; skipped otherwise)'
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgstattuple') AS have_pgstattuple \gset
\if :have_pgstattuple
SELECT c.relname AS index_name, p.avg_leaf_density, p.leaf_fragmentation,
       pg_size_pretty(p.index_size) AS index_size
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
JOIN pg_am am ON am.oid = c.relam AND am.amname = 'btree'
CROSS JOIN LATERAL pgstatindex(c.oid::regclass) p
WHERE c.relnamespace = 'public'::regnamespace
  AND pg_relation_size(c.oid) > 50 * 1024 * 1024
ORDER BY p.avg_leaf_density;
\endif

\echo '== 6. duplicate indexes (same table, same key columns/expressions, same predicate)'
SELECT t.relname AS table_name,
       array_agg(c.relname ORDER BY c.relname) AS duplicate_indexes,
       pg_size_pretty(sum(pg_relation_size(c.oid))) AS combined_size,
       min(pg_get_indexdef(i.indexrelid)) AS example_definition
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
WHERE t.relnamespace = 'public'::regnamespace
GROUP BY t.relname, i.indkey::text, i.indclass::text, coalesce(pg_get_expr(i.indexprs, i.indrelid), ''), coalesce(pg_get_expr(i.indpred, i.indrelid), '')
HAVING count(*) > 1
ORDER BY sum(pg_relation_size(c.oid)) DESC;

\echo '== 6b. left-prefix redundant indexes (a non-unique index whose columns are a leading prefix of another index with the same predicate)'
\echo '   heuristic: ignores opclass/collation/sort options and index size; a wider index is a slower substitute for tiny lookups'
SELECT t.relname AS table_name,
       a.relname AS redundant_index, pg_get_indexdef(ia.indexrelid) AS redundant_def,
       b.relname AS covered_by,      pg_get_indexdef(ib.indexrelid) AS covering_def,
       pg_size_pretty(pg_relation_size(a.oid)) AS redundant_size
FROM pg_index ia
JOIN pg_index ib ON ib.indrelid = ia.indrelid AND ib.indexrelid <> ia.indexrelid
JOIN pg_class a ON a.oid = ia.indexrelid
JOIN pg_class b ON b.oid = ib.indexrelid
JOIN pg_class t ON t.oid = ia.indrelid
WHERE t.relnamespace = 'public'::regnamespace
  AND NOT ia.indisunique AND NOT ia.indisprimary
  AND ia.indexprs IS NULL AND ib.indexprs IS NULL
  AND coalesce(pg_get_expr(ia.indpred, ia.indrelid), '') = coalesce(pg_get_expr(ib.indpred, ib.indrelid), '')
  -- int2vector is 0-based; slicing both sides normalises the lower bound for "="
  AND (ib.indkey::int2[])[0:array_length(ia.indkey::int2[], 1) - 1]
      = (ia.indkey::int2[])[0:array_length(ia.indkey::int2[], 1) - 1]
  AND (array_length(ib.indkey::int2[], 1) > array_length(ia.indkey::int2[], 1)
       OR (array_length(ib.indkey::int2[], 1) = array_length(ia.indkey::int2[], 1) AND ib.indisunique))
ORDER BY pg_relation_size(a.oid) DESC;
