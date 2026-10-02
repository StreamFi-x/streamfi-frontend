/**
 * GET /api/routes-f/subscription-my-active?viewer_id=<id>
 * Returns all active subscriptions for the current user. This mock has no
 * real session auth, so the caller (the "current user") is identified by
 * viewer_id, matching the pattern used by the other routes-f mocks.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionsForSubscriber } from "./seedData";
import { filterActiveSubscriptions } from "./utils";
import type { MyActiveSubscriptionsResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");

  if (!viewerId) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const subs = getSubscriptionsForSubscriber(viewerId);
  const subscriptions = filterActiveSubscriptions(subs);

  return NextResponse.json({
    subscriptions,
  } as MyActiveSubscriptionsResponse);
}
