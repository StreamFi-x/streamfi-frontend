import { NextRequest, NextResponse } from "next/server";
import { balanceStorage } from "../_lib/mock-storage";
import type {
  GrantRequest,
  BalanceResponse,
  ErrorResponse,
} from "../_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/routes-f/channel-points/balance?viewer_id=...&creator_id=...
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const viewerId = searchParams.get("viewer_id");
    const creatorId = searchParams.get("creator_id");

    if (!viewerId || !creatorId) {
      return NextResponse.json(
        { error: "Both viewer_id and creator_id query parameters are required" } as ErrorResponse,
        { status: 400 }
      );
    }

    const balance = balanceStorage.get(viewerId, creatorId);
    
    if (!balance) {
      return NextResponse.json(
        { error: "Balance not found for viewer/creator pair" } as ErrorResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: balance,
    } as BalanceResponse);
  } catch (error) {
    console.error("[channel-points balance GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" } as ErrorResponse,
      { status: 500 }
    );
  }
}

// POST /api/routes-f/channel-points/balance/grant
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { viewer_id, creator_id, amount, reason } = body as GrantRequest;

    // Validate required fields
    if (!viewer_id || !creator_id || amount === undefined || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: viewer_id, creator_id, amount, reason" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" } as ErrorResponse,
        { status: 400 }
      );
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "reason must be a non-empty string" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Grant points
    const updatedBalance = balanceStorage.grant(viewer_id, creator_id, amount);

    return NextResponse.json({
      data: updatedBalance,
      message: `Successfully granted ${amount} points`,
      details: { reason: reason.trim() },
    } as BalanceResponse & { details: { reason: string } });
  } catch (error) {
    console.error("[channel-points balance grant POST]", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message } as ErrorResponse,
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to grant points" } as ErrorResponse,
      { status: 500 }
    );
  }
}