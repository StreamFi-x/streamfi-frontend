import { NextRequest, NextResponse } from "next/server";
import { getBanSyncStatus, subscribeToBans } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creator_id = req.nextUrl.searchParams.get("creator_id")?.trim();

  if (!creator_id) {
    return NextResponse.json(
      { error: "creator_id query parameter is required." },
      { status: 400 }
    );
  }

  return NextResponse.json(getBanSyncStatus(creator_id));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    source_creator_id?: unknown;
    target_creator_id?: unknown;
    copy_existing?: unknown;
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
  const copy_existing = body.copy_existing === true;

  const result = subscribeToBans({
    source_creator_id,
    target_creator_id,
    copy_existing,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    getBanSyncStatus(target_creator_id),
    { status: 201 }
  );
}
