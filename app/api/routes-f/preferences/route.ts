import { NextResponse } from "next/server";
import {
  ROUTES_F_PREFERENCES_DEFAULTS,
  mergePreferences,
  validatePreferences,
} from "@/lib/routes-f/preferences";
import { withRoutesFLogging } from "@/lib/routes-f/logging";

const MOCK_USER_ID = "routes-f-user-001";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async () => {
    return NextResponse.json(
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
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const validation = validatePreferences(body);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = mergePreferences(body as Partial<typeof ROUTES_F_PREFERENCES_DEFAULTS>);

    return NextResponse.json(
      {
        userId: MOCK_USER_ID,
        preferences: updated,
      },
      { status: 200 }
    );
  });
}
