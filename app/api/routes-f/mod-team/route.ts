import { NextRequest, NextResponse } from "next/server";

/**
 * Channel Mod Team Management
 *
 * GET  ?creator_id=...                              → list of mods for creator
 * POST { creator_id, viewer_id, role }              → add / update mod (upsert)
 * DELETE { creator_id, viewer_id }                  → remove mod
 *
 * Cap: max 20 mods per creator. POST returns 400 if limit reached for new mods.
 * Uses in-memory store — no DB.
 */

type ModRole = "mod" | "sr_mod" | "owner";

interface Mod {
  creator_id: string;
  viewer_id: string;
  role: ModRole;
  added_at: string;
}

const MOD_CAP = 20;

// In-memory store: "creator_id:viewer_id" → Mod
export const modStore = new Map<string, Mod>();

function storeKey(creator_id: string, viewer_id: string): string {
  return `${creator_id}:${viewer_id}`;
}

function modsForCreator(creator_id: string): Mod[] {
  const result: Mod[] = [];
  for (const mod of modStore.values()) {
    if (mod.creator_id === creator_id) {
      result.push(mod);
    }
  }
  return result;
}

const VALID_ROLES = new Set<string>(["mod", "sr_mod", "owner"]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const creator_id = searchParams.get("creator_id");

  if (!creator_id) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  return NextResponse.json({ moderators: modsForCreator(creator_id) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    creator_id,
    viewer_id,
    role,
  } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof creator_id !== "string" ||
    !creator_id ||
    typeof viewer_id !== "string" ||
    !viewer_id ||
    typeof role !== "string" ||
    !VALID_ROLES.has(role)
  ) {
    return NextResponse.json(
      {
        error:
          "creator_id (string), viewer_id (string), and role ('mod' | 'sr_mod' | 'owner') are required",
      },
      { status: 400 }
    );
  }

  const key = storeKey(creator_id, viewer_id);
  const isExisting = modStore.has(key);

  if (!isExisting) {
    // New mod — check cap
    const existing = modsForCreator(creator_id);
    if (existing.length >= MOD_CAP) {
      return NextResponse.json(
        { error: `Cannot exceed ${MOD_CAP} moderators per creator` },
        { status: 400 }
      );
    }
  }

  const mod: Mod = {
    creator_id,
    viewer_id,
    role: role as ModRole,
    added_at: isExisting
      ? (modStore.get(key)!.added_at)
      : new Date().toISOString(),
  };

  modStore.set(key, mod);

  return NextResponse.json(mod, { status: isExisting ? 200 : 201 });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, viewer_id } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof creator_id !== "string" ||
    !creator_id ||
    typeof viewer_id !== "string" ||
    !viewer_id
  ) {
    return NextResponse.json(
      { error: "creator_id and viewer_id are required" },
      { status: 400 }
    );
  }

  const key = storeKey(creator_id, viewer_id);
  if (!modStore.has(key)) {
    return NextResponse.json({ error: "Moderator not found" }, { status: 404 });
  }

  modStore.delete(key);

  return NextResponse.json({ message: "Moderator removed" });
}
