import { NextRequest, NextResponse } from "next/server";
import type { ReorderBody } from "../types";
import { reorderPlaylist } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ReorderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, order } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json(
      { error: "order must be a non-empty array of vod_ids" },
      { status: 400 }
    );
  }

  try {
    reorderPlaylist(viewer_id, order);
    return NextResponse.json({ message: "Playlist reordered" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("No playlist found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
