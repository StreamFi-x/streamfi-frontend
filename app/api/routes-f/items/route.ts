// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// DB schema (apply once via migration):
//
// CREATE TYPE item_type AS ENUM ('gift', 'sticker', 'effect', 'badge_frame', 'chat_color');
//
// CREATE TABLE items_catalog (
//   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   type          item_type NOT NULL,
//   name          TEXT NOT NULL,
//   slug          TEXT NOT NULL UNIQUE,
//   description   TEXT,
//   emoji         TEXT,
//   image_url     TEXT,
//   price_usd     NUMERIC(10,2),
//   price_usdc    NUMERIC(10,2),
//   animation     TEXT,
//   tier          TEXT,
//   sort_order    INT DEFAULT 0,
//   active        BOOLEAN DEFAULT true,
//   metadata      JSONB
// );
//
// Seed data (run once):
// INSERT INTO items_catalog (type, name, slug, emoji, price_usd, price_usdc, animation, tier, sort_order)
// VALUES
//   ('gift', 'Flower', 'gift-flower', '🌸', 1.00,   1.00,   'flower',  'common',    1),
//   ('gift', 'Candy',  'gift-candy',  '🍬', 5.00,   5.00,   'candy',   'common',    2),
//   ('gift', 'Crown',  'gift-crown',  '👑', 25.00,  25.00,  'crown',   'rare',      3),
//   ('gift', 'Lion',   'gift-lion',   '🦁', 100.00, 100.00, 'lion',    'rare',      4),
//   ('gift', 'Dragon', 'gift-dragon', '🐉', 500.00, 500.00, 'dragon',  'legendary', 5);
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getAuthUser } from "@/lib/auth";

const CACHE_KEY = "items_catalog";
const CACHE_TTL = 300; // 5 minutes

async function invalidateCatalogCache() {
  await redis.del(CACHE_KEY);
  // Invalidate any type-scoped keys
  const keys = await redis.keys("items_catalog:type:*");
  if (keys.length > 0) await redis.del(...keys);
}

/**
 * GET /api/routes-f/items
 * Returns all active items, optionally filtered by ?type=gift|sticker|effect|...
 * Full catalog cached in Redis with 5-minute TTL.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const cacheKey = type ? `items_catalog:type:${type}` : CACHE_KEY;

  // 1. Try cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached as string), {
      headers: { "X-Cache": "HIT" },
    });
  }

  // 2. Query DB
  const params: unknown[] = [];
  let query =
    "SELECT id, type, name, slug, emoji, image_url, price_usd, price_usdc, animation, tier, active FROM items_catalog WHERE active = true";

  if (type) {
    params.push(type);
    query += ` AND type = $${params.length}`;
  }

  query += " ORDER BY sort_order ASC, name ASC";

  const { rows } = await db.query(query, params);

  const response = { items: rows };

  // 3. Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

  return NextResponse.json(response, {
    headers: { "X-Cache": "MISS" },
  });
}

/**
 * POST /api/routes-f/items
 * Admin-only: create a new catalog item.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    type,
    name,
    slug,
    description,
    emoji,
    image_url,
    price_usd,
    price_usdc,
    animation,
    tier,
    sort_order = 0,
    metadata,
  } = body;

  if (!type || !name || !slug) {
    return NextResponse.json(
      { error: "type, name, and slug are required" },
      { status: 400 }
    );
  }

  const { rows } = await db.query(
    `INSERT INTO items_catalog
       (type, name, slug, description, emoji, image_url, price_usd, price_usdc, animation, tier, sort_order, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      type,
      name,
      slug,
      description ?? null,
      emoji ?? null,
      image_url ?? null,
      price_usd ?? null,
      price_usdc ?? null,
      animation ?? null,
      tier ?? null,
      sort_order,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  // Invalidate catalog cache
  await invalidateCatalogCache();

  return NextResponse.json({ item: rows[0] }, { status: 201 });
}
