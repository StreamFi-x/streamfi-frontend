import { CACHE_POLICIES } from "@/lib/cache";
import { fetchLiveStreams } from "@/lib/streams/live-streams";
import { apiV1 } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerWallet = searchParams.get("viewer_wallet");
    const rawOffset = searchParams.get("offset");

    let offset = 0;
    if (rawOffset !== null) {
      if (!/^\d+$/.test(rawOffset)) {
        return apiV1.badRequest("offset must be a non-negative integer");
      }
      offset = parseInt(rawOffset, 10);
    }

    const result = await fetchLiveStreams({ viewerWallet, offset });

    return apiV1.success(result, {
      headers: {
        "Cache-Control": CACHE_POLICIES.liveState.cacheControl,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[v1/streams/live] Error fetching live streams:", error);
    return apiV1.internalError("Failed to fetch live streams");
  }
}

export async function POST() {
  return apiV1.methodNotAllowed("GET");
}
