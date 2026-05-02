import { NextRequest, NextResponse } from "next/server";
import { getAll, getOne, upsert, remove, isEnabledForUser } from "./_lib/store";
import type { UpsertBody } from "./_lib/types";

// GET /api/routes-f/feature-flags
// GET /api/routes-f/feature-flags?key=foo
// GET /api/routes-f/feature-flags?key=foo&user_id=bar  (returns enabled_for_user)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const key = searchParams.get("key");
  const userId = searchParams.get("user_id");

  if (key) {
    const flag = getOne(key);
    if (!flag) {
      return NextResponse.json({ error: `Flag '${key}' not found` }, { status: 404 });
    }
    const response: Record<string, unknown> = { flag };
    if (userId !== null) {
      response.enabled_for_user = isEnabledForUser(flag, userId);
    }
    return NextResponse.json(response);
  }

  return NextResponse.json({ flags: getAll() });
}

// PUT /api/routes-f/feature-flags  body: { key, enabled, rollout_percent? }
export async function PUT(req: NextRequest) {
  let body: UpsertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, enabled, rollout_percent } = body ?? {};

  if (typeof key !== "string" || key.trim() === "") {
    return NextResponse.json({ error: "'key' must be a non-empty string" }, { status: 400 });
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "'enabled' must be a boolean" }, { status: 400 });
  }

  const pct = rollout_percent === undefined ? 100 : Number(rollout_percent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: "'rollout_percent' must be between 0 and 100" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const existing = getOne(key.trim());
  const flag = {
    key: key.trim(),
    enabled,
    rollout_percent: pct,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  upsert(flag);
  return NextResponse.json({ flag }, { status: existing ? 200 : 201 });
}

// DELETE /api/routes-f/feature-flags?key=foo
export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "'key' query param is required" }, { status: 400 });
  }
  const deleted = remove(key);
  if (!deleted) {
    return NextResponse.json({ error: `Flag '${key}' not found` }, { status: 404 });
  }
  return NextResponse.json({ deleted: true, key });
}
