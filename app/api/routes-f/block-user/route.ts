/**
 * Block a user — issue #992
 *
 * POST   { blocker_id, blocked_id, reason? }        -> { blocked_at }
 * DELETE ?blocker_id&blocked_id                      -> { success: true }
 * GET    ?blocker_id                                 -> { blocked: BlockRecord[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { blockStore, blockKey, _resetStore } from "./store";
import { BlockRecord } from "./types";

export { _resetStore };

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Route /check is handled by the check sub-route; here we handle plain block
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const { blocker_id, blocked_id, reason } = body as {
    blocker_id?: unknown;
    blocked_id?: unknown;
    reason?: unknown;
  };

  if (!blocker_id || typeof blocker_id !== "string") return bad("blocker_id is required");
  if (!blocked_id || typeof blocked_id !== "string") return bad("blocked_id is required");
  if (blocker_id === blocked_id) return bad("A user cannot block themselves");

  const record: BlockRecord = {
    blocker_id,
    blocked_id,
    blocked_at: new Date().toISOString(),
    ...(reason && typeof reason === "string" ? { reason } : {}),
  };

  blockStore.set(blockKey(blocker_id, blocked_id), record);
  return NextResponse.json({ blocked_at: record.blocked_at }, { status: 201 });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const blocker_id = params.get("blocker_id");
  const blocked_id = params.get("blocked_id");

  if (!blocker_id) return bad("blocker_id is required");
  if (!blocked_id) return bad("blocked_id is required");

  const key = blockKey(blocker_id, blocked_id);
  if (!blockStore.has(key)) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  blockStore.delete(key);
  return NextResponse.json({ success: true }, { status: 200 });
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const blocker_id = new URL(req.url).searchParams.get("blocker_id");
  if (!blocker_id) return bad("blocker_id is required");

  const blocked: BlockRecord[] = [];
  for (const record of blockStore.values()) {
    if (record.blocker_id === blocker_id) blocked.push(record);
  }

  return NextResponse.json({ blocked }, { status: 200 });
}
