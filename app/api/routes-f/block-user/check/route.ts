/**
 * POST /api/routes-f/block-user/check
 * { a, b } -> { blocked: boolean, direction: "a_blocks_b" | "b_blocks_a" | "both" | "none" }
 */
import { NextRequest, NextResponse } from "next/server";
import { blockStore, blockKey } from "../store";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { a, b } = body as { a?: unknown; b?: unknown };
  if (!a || typeof a !== "string") {return NextResponse.json({ error: "a is required" }, { status: 400 });}
  if (!b || typeof b !== "string") {return NextResponse.json({ error: "b is required" }, { status: 400 });}

  const aBlocksB = blockStore.has(blockKey(a, b));
  const bBlocksA = blockStore.has(blockKey(b, a));

  let direction: "a_blocks_b" | "b_blocks_a" | "both" | "none";
  if (aBlocksB && bBlocksA) {direction = "both";}
  else if (aBlocksB) {direction = "a_blocks_b";}
  else if (bBlocksA) {direction = "b_blocks_a";}
  else {direction = "none";}

  return NextResponse.json({ blocked: aBlocksB || bBlocksA, direction }, { status: 200 });
}
