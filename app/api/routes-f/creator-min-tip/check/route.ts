import { NextRequest, NextResponse } from "next/server";
import { checkTip } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { creator_id, asset, amount } = body;

  if (typeof creator_id !== "string" || !creator_id.trim()) {
    return NextResponse.json(
      { error: "creator_id is required." },
      { status: 400 }
    );
  }
  if (typeof asset !== "string" || !asset.trim()) {
    return NextResponse.json(
      { error: "asset is required." },
      { status: 400 }
    );
  }
  if (typeof amount !== "number" || amount < 0) {
    return NextResponse.json(
      { error: "amount must be a number >= 0." },
      { status: 400 }
    );
  }

  const result = checkTip(creator_id, asset, amount);
  return NextResponse.json(result);
}
