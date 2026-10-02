import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { fetchDailySummary } from "../_lib/db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const date = new URL(req.url).searchParams.get("date")?.trim();

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date query parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    return NextResponse.json({ error: "date is not a valid calendar date" }, { status: 400 });
  }

  try {
    const summary = await fetchDailySummary(session.userId, date);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[routes-f activity/daily GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch daily activity summary" },
      { status: 500 }
    );
  }
}
