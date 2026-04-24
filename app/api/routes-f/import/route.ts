import { validateRoutesFRecord } from "@/lib/routes-f/schema";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { routesFSuccess, routesFError } from "../../routesF/response";

const MAX_RECORDS = 100;
const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 KB

export async function POST(req: Request) {
  return withRoutesFLogging(req, async (request) => {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_PAYLOAD_BYTES) {
      return routesFError("Payload too large", 413);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return routesFError("Invalid JSON payload", 400);
    }

    if (!Array.isArray(body)) {
      return routesFError("Payload must be an array of records", 400);
    }

    if (body.length > MAX_RECORDS) {
      return routesFError(`Too many records. Max is ${MAX_RECORDS}`, 400);
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

    const validCount = results.filter((result) => result.ok).length;
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

    // Handle combined success + partial failure
    if (validCount > 0 && invalidCount > 0) {
      return routesFSuccess(responsePayload, 207);
    }

    // All invalid
    if (validCount === 0) {
      return routesFSuccess(responsePayload, 422);
    }

    // All valid
    return routesFSuccess(responsePayload, 200);
  });
}