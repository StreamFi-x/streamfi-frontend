import { NextResponse } from "next/server";
import { validateRoutesFRecord } from "@/lib/routes-f/schema";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { jsonResponse } from "@/lib/routes-f/version";

export async function POST(req: Request) {
  return withRoutesFLogging(req, async request => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const result = validateRoutesFRecord(body);

    if (!result.isValid) {
      return jsonResponse(
        {
          isValid: false,
          errors: result.errors,
          warnings: result.warnings,
        },
        { status: 422 }
      );
    }

    return jsonResponse(
      {
        isValid: true,
        errors: [],
        warnings: result.warnings,
      },
      { status: 200 }
    );
  });
}
