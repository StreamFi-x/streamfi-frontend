import { sql } from "@vercel/postgres";

export async function ensureClipCollectionsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_clip_collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_clip_collection_items (
      collection_id UUID NOT NULL REFERENCES route_f_clip_collections(id) ON DELETE CASCADE,
      clip_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_id, clip_id),
      UNIQUE (collection_id, position)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_clip_collections_creator
    ON route_f_clip_collections (creator_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_clip_collection_items_collection
    ON route_f_clip_collection_items (collection_id, position ASC)
  `;
}
