import { CACHE_POLICIES } from "@/lib/cache";
import { fetchLiveStreams } from "@/lib/streams/live-streams";
import { API_VERSION_HEADER, apiInternalError, apiSuccess } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerWallet = searchParams.get("viewer_wallet");
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") ?? "0", 10) || 0
    );

    const result = await fetchLiveStreams({ viewerWallet, offset });

    return apiSuccess(result, {
      headers: {
        "Cache-Control": CACHE_POLICIES.liveState.cacheControl,
        [API_VERSION_HEADER]: "unversioned",
      },
      legacyFlat: true,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching live streams:", error);
    return apiInternalError("Failed to fetch live streams");
  }
}
