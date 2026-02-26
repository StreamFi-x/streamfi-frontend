import { jsonResponse } from "@/lib/routes-f/version";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { getTimingStats } from "@/lib/routes-f/diagnostics";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async () => {
    const stats = getTimingStats();
    return jsonResponse({ timings: stats }, { status: 200 });
  });
}
