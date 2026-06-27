import { NextRequest, NextResponse } from "next/server";
import { createAppeal, listPendingAppeals } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creator_id = req.nextUrl.searchParams.get("creator_id")?.trim();

  if (!creator_id) {
    return NextResponse.json(
      { error: "creator_id query parameter is required." },
      { status: 400 }
    );
  }

  const appeals = listPendingAppeals(creator_id);
  return NextResponse.json({ appeals });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    creator_id?: unknown;
    viewer_id?: unknown;
    message?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const creator_id =
    typeof body.creator_id === "string" ? body.creator_id : "";
  const viewer_id = typeof body.viewer_id === "string" ? body.viewer_id : "";
  const message = typeof body.message === "string" ? body.message : "";

  const result = createAppeal({ creator_id, viewer_id, message });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.result, { status: 201 });
}
