import { sql } from "@vercel/postgres";

export const GIFT_CATALOG = [
  {
    id: "flower",
    name: "Flower",
    price_usd: 1,
    icon_url: "/images/gifts/flower.png",
    animation_url: "/animations/gifts/flower.json",
  },
  {
    id: "candy",
    name: "Candy",
    price_usd: 5,
    icon_url: "/images/gifts/candy.png",
    animation_url: "/animations/gifts/candy.json",
  },
  {
    id: "crown",
    name: "Crown",
    price_usd: 25,
    icon_url: "/images/gifts/crown.png",
    animation_url: "/animations/gifts/crown.json",
  },
  {
    id: "lion",
    name: "Lion",
    price_usd: 100,
    icon_url: "/images/gifts/lion.png",
    animation_url: "/animations/gifts/lion.json",
  },
  {
    id: "dragon",
    name: "Dragon",
    price_usd: 500,
    icon_url: "/images/gifts/dragon.png",
    animation_url: "/animations/gifts/dragon.json",
  },
] as const;

export type GiftCatalogItem = (typeof GIFT_CATALOG)[number];

export async function ensureGiftSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS gift_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
      creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
      recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
      stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
      gift_id TEXT NOT NULL,
      gift_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      amount_usdc NUMERIC(20,2) NOT NULL DEFAULT 0,
      tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE gift_transactions
    ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE
  `;

  await sql`
    ALTER TABLE gift_transactions
    ADD COLUMN IF NOT EXISTS gift_id TEXT
  `;

  await sql`
    ALTER TABLE gift_transactions
    ADD COLUMN IF NOT EXISTS gift_name TEXT
  `;

  await sql`
    ALTER TABLE gift_transactions
    ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1
  `;

  await sql`
    ALTER TABLE gift_transactions
    ADD COLUMN IF NOT EXISTS tx_hash TEXT
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_gift_transactions_supporter_created
    ON gift_transactions (supporter_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_gift_transactions_creator_created
    ON gift_transactions (creator_id, created_at DESC)
  `;
}

export function getGiftCatalogItem(id: string): GiftCatalogItem | undefined {
  return GIFT_CATALOG.find(item => item.id === id);
}
