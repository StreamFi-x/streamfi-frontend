import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  try {
    const actions: string[] = [];

    // --- stream_access_config (1 row per streamer) ---
    await sql`
      CREATE TABLE IF NOT EXISTS stream_access_config (
        streamer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        access_type VARCHAR(32) NOT NULL DEFAULT 'public',
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    actions.push("✅ Ensured table: stream_access_config");

    // --- stream_access_grants (viewer grants, includes replay protection) ---
    await sql`
      CREATE TABLE IF NOT EXISTS stream_access_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        streamer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_type VARCHAR(32) NOT NULL,
        tx_hash VARCHAR(128),
        amount_usdc VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (streamer_id, viewer_id, access_type),
        UNIQUE (tx_hash)
      )
    `;
    actions.push("✅ Ensured table: stream_access_grants");

    await sql`ALTER TABLE stream_access_grants ADD COLUMN IF NOT EXISTS amount_usdc VARCHAR(32)`;
    actions.push("✅ Ensured column: stream_access_grants.amount_usdc");

    // Indexes for fast access checks + dashboards
    await sql`CREATE INDEX IF NOT EXISTS idx_stream_access_grants_streamer ON stream_access_grants(streamer_id)`;
    actions.push("✅ Ensured index: idx_stream_access_grants_streamer");

    await sql`CREATE INDEX IF NOT EXISTS idx_stream_access_grants_viewer ON stream_access_grants(viewer_id)`;
    actions.push("✅ Ensured index: idx_stream_access_grants_viewer");

    await sql`CREATE INDEX IF NOT EXISTS idx_stream_access_grants_type ON stream_access_grants(access_type)`;
    actions.push("✅ Ensured index: idx_stream_access_grants_type");

    await sql`CREATE INDEX IF NOT EXISTS idx_stream_access_config_type ON stream_access_config(access_type)`;
    actions.push("✅ Ensured index: idx_stream_access_config_type");

    return NextResponse.json({ ok: true, actions });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

