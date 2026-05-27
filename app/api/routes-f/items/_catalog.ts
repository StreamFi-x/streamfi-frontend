import { NextRequest } from "next/server";

// ----- Shared catalog store -----
export const ITEMS_CATALOG: {
  id: string;
  type: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  image_url: string | null;
  price_usd: number | null;
  price_usdc: number | null;
  animation: string | null;
  tier: string | null;
  sort_order: number;
  active: boolean;
  metadata: Record<string, unknown>;
}[] = [
  {
    id: "a1b2c3d4-0001-0000-0000-000000000001",
    type: "gift",
    name: "Flower",
    slug: "gift-flower",
    description: "A beautiful flower gift.",
    emoji: "🌸",
    image_url: null,
    price_usd: 1.0,
    price_usdc: 1.0,
    animation: "flower",
    tier: "common",
    sort_order: 1,
    active: true,
    metadata: {},
  },
  {
    id: "a1b2c3d4-0002-0000-0000-000000000002",
    type: "gift",
    name: "Candy",
    slug: "gift-candy",
    description: "Sweet candy for your favourite streamer.",
    emoji: "🍬",
    image_url: null,
    price_usd: 5.0,
    price_usdc: 5.0,
    animation: "candy",
    tier: "common",
    sort_order: 2,
    active: true,
    metadata: {},
  },
  {
    id: "a1b2c3d4-0003-0000-0000-000000000003",
    type: "gift",
    name: "Crown",
    slug: "gift-crown",
    description: "A rare crown fit for royalty.",
    emoji: "👑",
    image_url: null,
    price_usd: 25.0,
    price_usdc: 25.0,
    animation: "crown",
    tier: "rare",
    sort_order: 3,
    active: true,
    metadata: {},
  },
  {
    id: "a1b2c3d4-0004-0000-0000-000000000004",
    type: "gift",
    name: "Lion",
    slug: "gift-lion",
    description: "A majestic lion gift.",
    emoji: "🦁",
    image_url: null,
    price_usd: 100.0,
    price_usdc: 100.0,
    animation: "lion",
    tier: "rare",
    sort_order: 4,
    active: true,
    metadata: {},
  },
  {
    id: "a1b2c3d4-0005-0000-0000-000000000005",
    type: "gift",
    name: "Dragon",
    slug: "gift-dragon",
    description: "The legendary dragon — the ultimate gift.",
    emoji: "🐉",
    image_url: null,
    price_usd: 500.0,
    price_usdc: 500.0,
    animation: "dragon",
    tier: "legendary",
    sort_order: 5,
    active: true,
    metadata: {},
  },
];

// Simulated Redis cache (in-memory, 5 min TTL)
let catalogCache: { data: typeof ITEMS_CATALOG; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getCachedCatalog() {
  if (catalogCache && Date.now() < catalogCache.expiresAt) {
    return catalogCache.data;
  }
  return null;
}

export function setCatalogCache(data: typeof ITEMS_CATALOG) {
  catalogCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
}

export function invalidateCatalogCache() {
  catalogCache = null;
}

export function isAdmin(request: NextRequest): boolean {
  const adminToken = request.headers.get("x-admin-token");
  return adminToken === process.env.ADMIN_SECRET_TOKEN;
}
