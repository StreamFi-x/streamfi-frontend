import { readFileSync } from "fs";
import path from "path";
import type { Pool } from "pg";

/** Production viewer table shapes and real migrations, independent of unrelated features. */
export async function applyViewerSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT,
      wallet TEXT, mux_stream_id TEXT, mux_playback_id TEXT,
      stream_started_at TIMESTAMPTZ, is_live BOOLEAN DEFAULT false,
      deleted_at TIMESTAMPTZ, current_viewers INTEGER DEFAULT 0,
      total_views INTEGER DEFAULT 0, updated_at TIMESTAMPTZ
    );
    CREATE TABLE stream_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id),
      mux_session_id TEXT, started_at TIMESTAMPTZ DEFAULT now(), ended_at TIMESTAMPTZ,
      peak_viewers INTEGER DEFAULT 0, total_unique_viewers INTEGER DEFAULT 0
    );
    CREATE TABLE stream_viewers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_session_id UUID REFERENCES stream_sessions(id), user_id UUID REFERENCES users(id),
      session_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      joined_at TIMESTAMPTZ DEFAULT now(), left_at TIMESTAMPTZ,
      ip_address INET, country VARCHAR(2)
    );
  `);
  for (const file of [
    "20260926121650_add_stream_viewer_heartbeat.sql",
    "20261022090000_verified_viewer_peaks.sql",
  ]) {
    await pool.query(
      readFileSync(path.join(process.cwd(), "db/migrations", file), "utf8")
    );
  }
}
