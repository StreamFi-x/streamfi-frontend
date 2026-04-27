import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { getSinglePayout } from "@/lib/routes-f/payouts";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    const payout = await getSinglePayout(session.userId, id);
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    return NextResponse.json({ payout });
  } catch (error) {
    console.error("[routes-f payout by id GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch payout" },
      { status: 500 }
    );
  }
}
