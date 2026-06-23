import { NextRequest, NextResponse } from "next/server";

// In-memory store for blocklists, keyed by creator_id
const blocklistStore = new Map<string, Set<string>>();

const MAX_ENTRIES = 200;

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const blocklist = blocklistStore.get(creatorId) || new Set<string>();
  const words = Array.from(blocklist);

  return NextResponse.json({ words });
}

export async function POST(req: NextRequest) {
  let body: {
    creator_id?: unknown;
    add?: unknown;
    remove?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, add, remove } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required and must be a string" },
      { status: 400 }
    );
  }

  // Get or create blocklist for this creator
  let blocklist = blocklistStore.get(creator_id);
  if (!blocklist) {
    blocklist = new Set<string>();
    blocklistStore.set(creator_id, blocklist);
  }

  // Process additions
  if (add !== undefined) {
    if (!Array.isArray(add)) {
      return NextResponse.json(
        { error: "add must be an array of strings" },
        { status: 400 }
      );
    }

    for (const item of add) {
      if (typeof item !== "string") {
        return NextResponse.json(
          { error: "add must be an array of strings" },
          { status: 400 }
        );
      }

      const normalized = normalizeWord(item);
      if (normalized) {
        // Check cap before adding
        if (blocklist.size >= MAX_ENTRIES && !blocklist.has(normalized)) {
          return NextResponse.json(
            { error: `Blocklist cap reached (max ${MAX_ENTRIES} entries)` },
            { status: 400 }
          );
        }
        blocklist.add(normalized);
      }
    }
  }

  // Process removals
  if (remove !== undefined) {
    if (!Array.isArray(remove)) {
      return NextResponse.json(
        { error: "remove must be an array of strings" },
        { status: 400 }
      );
    }

    for (const item of remove) {
      if (typeof item !== "string") {
        return NextResponse.json(
          { error: "remove must be an array of strings" },
          { status: 400 }
        );
      }

      const normalized = normalizeWord(item);
      if (normalized) {
        blocklist.delete(normalized);
      }
    }
  }

  // Return updated blocklist
  const words = Array.from(blocklist);
  return NextResponse.json({ words });
}
