import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getAuthUser } from "@/lib/auth";

const CATALOG_CACHE_KEY = "items_catalog";

async function invalidateCatalogCache() {
  await redis.del(CATALOG_CACHE_KEY);
  const keys = await redis.keys("items_catalog:type:*");
  if (keys.length > 0) await redis.del(...keys);
}

/**
 * GET /api/routes-f/items/[id]
 * Returns a single catalog item by UUID.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const cacheKey = `items_catalog:item:${id}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached as string), {
      headers: { "X-Cache": "HIT" },
    });
  }

  const { rows } = await db.query(
    `SELECT id, type, name, slug, description, emoji, image_url,
            price_usd, price_usdc, animation, tier, active, metadata
     FROM items_catalog
     WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const response = { item: rows[0] };
  await redis.setex(cacheKey, 300, JSON.stringify(response));

  return NextResponse.json(response, { headers: { "X-Cache": "MISS" } });
}

/**
 * PATCH /api/routes-f/items/[id]
 * Admin-only: update a catalog item.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();

  const allowed = [
    "type", "name", "slug", "description", "emoji", "image_url",
    "price_usd", "price_usdc", "animation", "tier", "sort_order",
    "active", "metadata",
  ];

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = $${idx}`);
      values.push(key === "metadata" && body[key] ? JSON.stringify(body[key]) : body[key]);
      idx++;
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  values.push(id);
  const { rows } = await db.query(
    `UPDATE items_catalog SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Invalidate caches
  await invalidateCatalogCache();
  await redis.del(`items_catalog:item:${id}`);

  return NextResponse.json({ item: rows[0] });
}
