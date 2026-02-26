import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { jsonResponse } from "@/lib/routes-f/version";

function getVersionInfo() {
  return (
    process.env.APP_VERSION ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "unknown"
  );
}

export async function GET(req: Request) {
  return withRoutesFLogging(req, async () => {
    const payload = {
      status: "ok",
      version: getVersionInfo(),
      timestamp: new Date().toISOString(),
    };

    return jsonResponse(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  });
}
