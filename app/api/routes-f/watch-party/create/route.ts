import { NextRequest, NextResponse } from "next/server";
import type { CreateRequest, CreateResponse } from "../types";
import { createParty } from "../store";

/**
 * POST /api/routes-f/watch-party/create
 * Body: { host_id, vod_id }
 *
 * Creates a new watch party hosted by host_id for the given VOD and returns the
 * party_id and a shareable join_code.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<CreateRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.host_id) {
    return NextResponse.json({ error: "host_id is required" }, { status: 400 });
  }
  if (!body.vod_id) {
    return NextResponse.json({ error: "vod_id is required" }, { status: 400 });
  }

  const party = createParty(body.host_id, body.vod_id);
  const response: CreateResponse = {
    party_id: party.party_id,
    join_code: party.join_code,
  };
  return NextResponse.json(response, { status: 201 });
}
