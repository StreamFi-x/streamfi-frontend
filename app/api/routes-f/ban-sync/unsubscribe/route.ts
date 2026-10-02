import { NextRequest, NextResponse } from "next/server";
import { getBanSyncStatus, unsubscribeFromBans } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    source_creator_id?: unknown;
    target_creator_id?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const source_creator_id =
    typeof body.source_creator_id === "string" ? body.source_creator_id : "";
  const target_creator_id =
    typeof body.target_creator_id === "string" ? body.target_creator_id : "";

  const result = unsubscribeFromBans({
    source_creator_id,
    target_creator_id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(getBanSyncStatus(target_creator_id));
}
