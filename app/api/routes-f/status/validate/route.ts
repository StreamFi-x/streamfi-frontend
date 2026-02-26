import { jsonResponse } from "@/lib/routes-f/version";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { validateTransition } from "@/lib/routes-f/status-validator";

export async function POST(req: Request) {
  return withRoutesFLogging(req, async () => {
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return jsonResponse({ error: "invalid-json" }, { status: 422 });
    }

    const { id, target } = body ?? {};
    if (!id || !target) {
      return jsonResponse({ error: "missing-fields" }, { status: 422 });
    }

    const result = validateTransition(id, target);
    if (!result.ok) {
      return jsonResponse({ error: result.error }, { status: 422 });
    }

    return jsonResponse({ allowed: result.allowed, reasons: result.reasons }, { status: 200 });
  });
}
