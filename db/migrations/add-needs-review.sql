-- Add needs_review flag to stream_recordings
-- Set to TRUE by the Mux webhook when a new recording is first saved.
-- Cleared (FALSE) when the owner acknowledges the recording in the dashboard.
-- Run against your Vercel Postgres instance once:
--   npx vercel env pull && psql $POSTGRES_URL -f db/migrations/add-needs-review.sql

ALTER TABLE stream_recordings
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
