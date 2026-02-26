import { NextResponse } from "next/server";
import { jsonResponse } from "@/lib/routes-f/version";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { ALLOWED_METRICS, computeLeaderboard } from "@/lib/routes-f/leaderboard";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async () => {
    const url = new URL(req.url);
    const metric = url.searchParams.get("metric") ?? "";
    const limitParam = url.searchParams.get("limit") ?? "10";
    const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 100);

    if (!ALLOWED_METRICS.includes(metric as any)) {
      return NextResponse.json({ error: "unsupported-metric" }, { status: 400 });
    }

    const data = computeLeaderboard(metric as any, limit);
    return jsonResponse({ metric, limit, items: data }, { status: 200 });
  });
}
