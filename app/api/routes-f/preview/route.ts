import { NextResponse } from "next/server";
import { validateRoutesFRecord } from "@/lib/routes-f/schema";
import { transformRoutesFPayload } from "@/lib/routes-f/transform";
import { withRoutesFLogging } from "@/lib/routes-f/logging";

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

    const validation = validateRoutesFRecord(body);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 }
      );
    }

    const preview = transformRoutesFPayload(
      body as Parameters<typeof transformRoutesFPayload>[0]
    );

    return NextResponse.json(
      {
        preview,
        validation: {
          isValid: true,
          warnings: validation.warnings,
        },
      },
      { status: 200 }
    );
  });
}
