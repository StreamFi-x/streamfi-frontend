import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const newBadges = await evaluateAndAwardBadges(session.userId);
    return NextResponse.json({
      new_badges: newBadges,
      total: newBadges.length,
    });
  } catch (error) {
    console.error("[routes-f badges check POST]", error);
    return NextResponse.json(
      { error: "Failed to evaluate badges" },
      { status: 500 }
    );
  }
}
