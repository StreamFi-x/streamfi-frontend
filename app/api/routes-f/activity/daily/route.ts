import {
  getActivityLimitConfig,
  getDailyActivitySummary,
} from "@/lib/routes-f/activity";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { jsonResponse } from "@/lib/routes-f/version";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async request => {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const summary = getDailyActivitySummary({ days: daysParam });
    const limits = getActivityLimitConfig();

    return jsonResponse(
      {
        days: summary.days,
        totalCount: summary.totalCount,
        perDay: summary.buckets,
        limits,
      },
      { status: 200 }
    );
  });
}
