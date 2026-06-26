import { NextRequest, NextResponse } from "next/server";
import { getParty } from "./store";

/**
 * GET /api/routes-f/watch-party?party_id=party_x
 *
 * Returns the latest synced state for a watch party.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const partyId = req.nextUrl.searchParams.get("party_id");
  if (!partyId) {
    return NextResponse.json(
      { error: "party_id is required" },
      { status: 400 }
    );
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json(
      { error: `unknown party_id: ${partyId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(party);
}
