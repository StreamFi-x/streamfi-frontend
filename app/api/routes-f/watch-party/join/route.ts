import { NextRequest, NextResponse } from "next/server";
import type { JoinRequest } from "../types";
import { joinParty } from "../store";

/**
 * POST /api/routes-f/watch-party/join
 * Body: { party_id, viewer_id }
 *
 * Adds a viewer to an existing party. Idempotent — joining twice is a no-op.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<JoinRequest>;
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
  if (!body.viewer_id) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const party = joinParty(body.party_id, body.viewer_id);
  if (!party) {
    return NextResponse.json(
      { error: `unknown party_id: ${body.party_id}` },
      { status: 404 }
    );
  }

  return NextResponse.json(party);
}
