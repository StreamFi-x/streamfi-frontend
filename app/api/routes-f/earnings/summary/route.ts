import { NextRequest, NextResponse } from "next/server";
import { getCreatorEarningsSummary } from "@/lib/routes-f/earnings";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const payload = await getCreatorEarningsSummary(session.userId);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[routes-f earnings summary]", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings summary" },
      { status: 500 }
    );
  }
}
