import { NextRequest, NextResponse } from "next/server";
import { getMinTip, setMinTip } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required." },
      { status: 400 }
    );
  }

  const config = getMinTip(creatorId);
  return NextResponse.json({
    min_xlm: config.min_xlm,
    min_usdc: config.min_usdc,
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { creator_id, min_xlm, min_usdc } = body;

  if (typeof creator_id !== "string" || !creator_id.trim()) {
    return NextResponse.json(
      { error: "creator_id is required." },
      { status: 400 }
    );
  }

  if (min_xlm !== undefined) {
    if (typeof min_xlm !== "number" || min_xlm < 0) {
      return NextResponse.json(
        { error: "min_xlm must be a number >= 0." },
        { status: 400 }
      );
    }
  }

  if (min_usdc !== undefined) {
    if (typeof min_usdc !== "number" || min_usdc < 0) {
      return NextResponse.json(
        { error: "min_usdc must be a number >= 0." },
        { status: 400 }
      );
    }
  }

  const updated = setMinTip(
    creator_id as string,
    min_xlm as number | undefined,
    min_usdc as number | undefined
  );
  return NextResponse.json({
    min_xlm: updated.min_xlm,
    min_usdc: updated.min_usdc,
  });
}
