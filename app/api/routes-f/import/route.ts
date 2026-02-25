import { NextResponse } from "next/server";
import { validateRoutesFRecord } from "@/lib/routes-f/schema";
import { withRoutesFLogging } from "@/lib/routes-f/logging";

const MAX_RECORDS = 100;
const MAX_PAYLOAD_BYTES = 100 * 1024;

export async function POST(req: Request) {
  return withRoutesFLogging(req, async request => {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Payload must be an array of records" },
        { status: 400 }
      );
    }

    if (body.length > MAX_RECORDS) {
      return NextResponse.json(
        { error: `Too many records. Max is ${MAX_RECORDS}` },
        { status: 400 }
      );
    }

    const results = body.map((item, index) => {
      const validation = validateRoutesFRecord(item);
      return {
        index,
        ok: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    });

    const validCount = results.filter(result => result.ok).length;
    const invalidCount = results.length - validCount;

    const responsePayload = {
      imported: validCount,
      failed: invalidCount,
      results,
      message:
        invalidCount === 0
          ? "Import simulated successfully"
          : "Import completed with validation errors",
    };

    if (validCount > 0 && invalidCount > 0) {
      return NextResponse.json(responsePayload, { status: 207 });
    }

    if (validCount === 0) {
      return NextResponse.json(responsePayload, { status: 422 });
    }

    return NextResponse.json(responsePayload, { status: 200 });
  });
}
