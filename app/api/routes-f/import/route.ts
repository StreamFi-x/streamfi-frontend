import { NextResponse } from "next/server";
import { validateRoutesFRecord } from "@/lib/routes-f/schema";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { withIdempotency } from "@/lib/routes-f/idempotency";
import { withPayloadGuard } from "@/lib/routes-f/payload-guard";

const MAX_RECORDS = 100;
const MAX_PAYLOAD_BYTES = 100 * 1024;

export async function POST(req: Request) {
  return withPayloadGuard(
    req,
    async (requestWithGuard) => {
      return withIdempotency(requestWithGuard, async (request) => {
        return withRoutesFLogging(request, async reqWithId => {
          let body: unknown;

          try {
            body = await reqWithId.json();
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
      });
    },
    { maxBytes: MAX_PAYLOAD_BYTES }
  );
}
