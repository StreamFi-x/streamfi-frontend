import { sql } from "@vercel/postgres";

export const COLLECTION_VISIBILITIES = ["public", "private"] as const;
export const COLLECTION_ITEM_TYPES = ["clip", "recording"] as const;

export async function ensureCollectionsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_collection_items (
      collection_id UUID NOT NULL REFERENCES route_f_collections(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (collection_id, item_id, item_type)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_collections_user_visibility
      ON route_f_collections (user_id, visibility, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_collection_items_collection
      ON route_f_collection_items (collection_id, created_at DESC)
  `;
}
