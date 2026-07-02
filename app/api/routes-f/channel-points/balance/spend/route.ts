import { NextRequest, NextResponse } from "next/server";
import { balanceStorage } from "../../_lib/mock-storage";
import type {
  SpendRequest,
  BalanceResponse,
  ErrorResponse,
} from "../../_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/routes-f/channel-points/balance/spend
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { viewer_id, creator_id, amount, item } = body as SpendRequest;

    // Validate required fields
    if (!viewer_id || !creator_id || amount === undefined || !item) {
      return NextResponse.json(
        { error: "Missing required fields: viewer_id, creator_id, amount, item" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof item !== "string" || item.trim().length === 0) {
      return NextResponse.json(
        { error: "item must be a non-empty string" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Spend points
    const updatedBalance = balanceStorage.spend(viewer_id, creator_id, amount);

    return NextResponse.json({
      data: updatedBalance,
      message: `Successfully spent ${amount} points`,
      details: { item: item.trim() },
    } as BalanceResponse & { details: { item: string } });
  } catch (error) {
    console.error("[channel-points balance spend POST]", error);
    
    if (error instanceof Error) {
      const status = error.message.includes("Insufficient balance") ? 400 : 404;
      return NextResponse.json(
        { error: error.message } as ErrorResponse,
        { status }
      );
    }

    return NextResponse.json(
      { error: "Failed to spend points" } as ErrorResponse,
      { status: 500 }
    );
  }
}