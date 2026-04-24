import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { routesFSuccess } from "../../routesF/response";

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
    const headers = new Headers({
      "Cache-Control": "no-store",
    });

    const payload = {
      status: "ok",
      version: getVersionInfo(),
      timestamp: new Date().toISOString(),
    };

    return routesFSuccess(payload, 200, headers);
  });
}