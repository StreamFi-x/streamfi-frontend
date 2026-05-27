-- Transcription jobs for VOD auto-generated captions
-- Run after add-stream-recording.sql

CREATE TABLE IF NOT EXISTS transcription_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    content TEXT,                        -- WebVTT text once ready
    error_reason TEXT,                   -- populated on failure
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recording_id)                 -- one active job per recording
);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recording_id
    ON transcription_jobs(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user_id
    ON transcription_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status
    ON transcription_jobs(status);
