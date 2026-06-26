import { NextRequest, NextResponse } from "next/server";
import type { SyncRequest } from "../types";
import { syncParty } from "../store";

/**
 * POST /api/routes-f/watch-party/sync
 * Body: { party_id, position_seconds, paused }
 *
 * Updates the shared playback position and paused state for a party. Typically
 * called by the host so other viewers can poll GET ?party_id for the latest.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<SyncRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.party_id) {
    return NextResponse.json(
      { error: "party_id is required" },
      { status: 400 }
    );
  }
  if (
    typeof body.position_seconds !== "number" ||
    !Number.isFinite(body.position_seconds) ||
    body.position_seconds < 0
  ) {
    return NextResponse.json(
      { error: "position_seconds must be a non-negative number" },
      { status: 400 }
    );
  }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json(
      { error: "paused must be a boolean" },
      { status: 400 }
    );
  }

  const party = syncParty(body.party_id, body.position_seconds, body.paused);
  if (!party) {
    return NextResponse.json(
      { error: `unknown party_id: ${body.party_id}` },
      { status: 404 }
    );
  }

  return NextResponse.json(party);
}
