import {
  ROUTES_F_PREFERENCES_DEFAULTS,
  mergePreferences,
  validatePreferences,
} from "@/lib/routes-f/preferences";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { jsonResponse } from "@/lib/routes-f/version";

const MOCK_USER_ID = "routes-f-user-001";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async () => {
    return jsonResponse(
      {
        userId: MOCK_USER_ID,
        preferences: ROUTES_F_PREFERENCES_DEFAULTS,
      },
      { status: 200 }
    );
  });
}

export async function POST(req: Request) {
  return withRoutesFLogging(req, async request => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const validation = validatePreferences(body);
    if (!validation.isValid) {
      return jsonResponse({ error: validation.error }, { status: 400 });
    }

    const updated = mergePreferences(body as Partial<typeof ROUTES_F_PREFERENCES_DEFAULTS>);

    return jsonResponse(
      {
        userId: MOCK_USER_ID,
        preferences: updated,
      },
      { status: 200 }
    );
  });
}
