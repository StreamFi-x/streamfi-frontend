import { NextRequest, NextResponse } from "next/server";
import { ITEMS_CATALOG, invalidateCatalogCache, isAdmin } from "../_catalog";

// ----- GET /api/routes-f/items/[id] -----
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const item = ITEMS_CATALOG.find((i) => i.id === id || i.slug === id);

  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  if (!item.active) {
    return NextResponse.json({ error: "Item not available." }, { status: 410 });
  }

  return NextResponse.json({ item }, { status: 200 });
}

// ----- PATCH /api/routes-f/items/[id] (admin only) -----
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: "Forbidden: admin access required." },
      { status: 403 }
    );
  }

  const { id } = params;
  const index = ITEMS_CATALOG.findIndex((i) => i.id === id || i.slug === id);

  if (index === -1) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Merge updates
  ITEMS_CATALOG[index] = { ...ITEMS_CATALOG[index], ...body };
  invalidateCatalogCache();

  return NextResponse.json({ item: ITEMS_CATALOG[index] }, { status: 200 });
}
