import {
  ROUTES_F_PREFERENCES_DEFAULTS,
  mergePreferences,
  validatePreferences,
} from "@/lib/routes-f/preferences";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { routesFSuccess, routesFError } from "../../routesF/response";

const MOCK_USER_ID = "routes-f-user-001";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async () => {
    return routesFSuccess(
      {
        userId: MOCK_USER_ID,
        preferences: ROUTES_F_PREFERENCES_DEFAULTS,
      },
      200
    );
  });
}

export async function POST(req: Request) {
  return withRoutesFLogging(req, async (request) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return routesFError("Invalid JSON payload", 400);
    }

    const validation = validatePreferences(body);
    if (!validation.isValid) {
      return routesFError(validation.error, 400);
    }

    const updated = mergePreferences(
      body as Partial<typeof ROUTES_F_PREFERENCES_DEFAULTS>
    );

    return routesFSuccess(
      {
        userId: MOCK_USER_ID,
        preferences: updated,
      },
      200
    );
  });
}