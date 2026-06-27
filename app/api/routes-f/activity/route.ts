import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { fetchActivityFeed } from "./_lib/db";
import { isValidActivityFeedFilter } from "./_lib/filters";
import type { ActivityFeedFilter } from "./_lib/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const cursor = searchParams.get("cursor") ?? undefined;
  const typeParam = searchParams.get("type") ?? "all";

  if (!isValidActivityFeedFilter(typeParam)) {
    return NextResponse.json(
      { error: "type must be one of: all, tips, follows, streams, gifts" },
      { status: 400 }
    );
  }

  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  if (cursor && Number.isNaN(Date.parse(cursor))) {
    return NextResponse.json(
      { error: "cursor must be a valid ISO timestamp" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchActivityFeed({
      userId: session.userId,
      limit,
      cursor,
      filter: typeParam as ActivityFeedFilter,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[routes-f activity GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch activity feed" },
      { status: 500 }
    );
  }
}
