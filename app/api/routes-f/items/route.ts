import { NextRequest, NextResponse } from "next/server";

// ----- In-memory seed data (replaces DB + Redis in this frontend-only context) -----
const ITEMS_CATALOG = [
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

function getCachedCatalog() {
  if (catalogCache && Date.now() < catalogCache.expiresAt) {
    return catalogCache.data;
  }
  return null;
}

function setCatalogCache(data: typeof ITEMS_CATALOG) {
  catalogCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
}

function invalidateCatalogCache() {
  catalogCache = null;
}

// ----- Helpers -----
function isAdmin(request: NextRequest): boolean {
  // In production, verify a session/JWT with admin role.
  // For now, check a header: X-Admin-Token
  const adminToken = request.headers.get("x-admin-token");
  return adminToken === process.env.ADMIN_SECRET_TOKEN;
}

// ----- GET /api/routes-f/items -----
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type"); // gift | sticker | effect | ...

  // Attempt to serve from cache (only for unfiltered full catalog)
  let items = getCachedCatalog();
  if (!items) {
    items = ITEMS_CATALOG;
    setCatalogCache(items);
  }

  // Always filter out inactive items for public listing
  let result = items.filter((item) => item.active);

  if (typeFilter) {
    result = result.filter((item) => item.type === typeFilter);
  }

  return NextResponse.json({ items: result }, { status: 200 });
}

// ----- POST /api/routes-f/items (admin only) -----
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: "Forbidden: admin access required." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requiredFields = ["type", "name", "slug"];
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // Check slug uniqueness
  const slugExists = ITEMS_CATALOG.some((i) => i.slug === body.slug);
  if (slugExists) {
    return NextResponse.json(
      { error: `Slug '${body.slug}' already exists.` },
      { status: 409 }
    );
  }

  const newItem = {
    id: crypto.randomUUID(),
    type: body.type as string,
    name: body.name as string,
    slug: body.slug as string,
    description: (body.description as string) ?? null,
    emoji: (body.emoji as string) ?? null,
    image_url: (body.image_url as string) ?? null,
    price_usd: (body.price_usd as number) ?? null,
    price_usdc: (body.price_usdc as number) ?? null,
    animation: (body.animation as string) ?? null,
    tier: (body.tier as string) ?? null,
    sort_order: (body.sort_order as number) ?? 0,
    active: (body.active as boolean) ?? true,
    metadata: (body.metadata as Record<string, unknown>) ?? {},
  };

  ITEMS_CATALOG.push(newItem);
  invalidateCatalogCache();

  return NextResponse.json({ item: newItem }, { status: 201 });
}
