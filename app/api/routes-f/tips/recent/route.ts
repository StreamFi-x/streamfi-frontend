import { NextRequest, NextResponse } from "next/server";

export interface Tip {
  tipper: string;
  amount_usdc: number;
  asset: "XLM" | "USDC";
  tx_hash: string;
  message?: string;
  ts: string; // ISO 8601 string
}

// Generate 30 seed tips with varied assets, amounts, messages, and timestamps
const SEED_TIPS: Tip[] = Array.from({ length: 30 }).map((_, idx) => {
  const assets: ("XLM" | "USDC")[] = ["XLM", "USDC"];
  const asset = assets[idx % 2];
  const amount_usdc = Number((1.5 * (idx + 1) + (idx % 3) * 0.75).toFixed(2));
  const messages = [
    "Awesome stream!",
    "Keep up the great work!",
    "Love the content!",
    "Super cool stream overlay!",
    undefined,
    "stellar network is so fast",
    "greetings from the chat!",
  ];
  return {
    tipper: `tipper_${idx + 1}`,
    amount_usdc,
    asset,
    tx_hash: `0x${idx.toString().padStart(64, "0")}`, // Unique transaction hash
    message: messages[idx % messages.length],
    ts: new Date(Date.now() - idx * 3600 * 1000).toISOString(), // older as index increases (already sorted newest first!)
  };
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;
  if (isNaN(limit) || limit <= 0) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const cursorParam = searchParams.get("cursor");
  const startIndex = cursorParam ? parseInt(cursorParam, 10) : 0;
  if (isNaN(startIndex) || startIndex < 0) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const paginatedTips = SEED_TIPS.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < SEED_TIPS.length ? (startIndex + limit).toString() : null;

  return NextResponse.json({
    tips: paginatedTips,
    next_cursor: nextCursor,
  });
}
