import { NextRequest, NextResponse } from "next/server";
import { getCreatorEarningsSeries } from "@/lib/routes-f/earnings";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);

  try {
    const payload = await getCreatorEarningsSeries({
      creatorId: session.userId,
      fromParam: searchParams.get("from"),
      toParam: searchParams.get("to"),
      groupByParam: searchParams.get("group_by"),
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch earnings",
      },
      { status: 400 }
    );
  }
}
