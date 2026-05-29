-- Track which capabilities the user's CURRENT Mux stream was provisioned with.
-- These let the UI detect "settings out of sync with Mux config" and prompt the
-- streamer to re-provision (rotate stream key) so their saved preferences
-- actually take effect.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_dvr BOOLEAN DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_signed_playback BOOLEAN DEFAULT FALSE;
