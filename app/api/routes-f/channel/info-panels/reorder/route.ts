import { NextRequest, NextResponse } from "next/server";
import type { ReorderPanelsBody } from "../types";
import { reorderPanels } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ReorderPanelsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, order } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json(
      { error: "order must be a non-empty array of panel_ids" },
      { status: 400 }
    );
  }

  try {
    reorderPanels(creator_id, order);
    return NextResponse.json({ message: "Panels reordered" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("No panels found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
