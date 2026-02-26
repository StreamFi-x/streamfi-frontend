import { NextResponse } from "next/server";
import { listRoutesFRecords, createRoutesFRecord } from "@/lib/routes-f/store";
import { withIdempotency } from "@/lib/routes-f/idempotency";
import { withPayloadGuard } from "@/lib/routes-f/payload-guard";
import { jsonResponse } from "@/lib/routes-f/version";

/**
 * GET /api/routes-f
 * List records with pagination support
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 50)
      : 20;

  const cursor = url.searchParams.get("cursor") || undefined;
  const status = url.searchParams.get("status") || "active";

  try {
    const result = listRoutesFRecords({ limit, cursor, status });
    return jsonResponse(result, { status: 200 });
  } catch {
    return jsonResponse({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/routes-f
 * Create a new record
 */
export async function POST(req: Request) {
  return withPayloadGuard(req, async (requestWithGuard) => {
    return withIdempotency(requestWithGuard, async (request) => {
      let body;

      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
      }

      try {
        const newRecord = createRoutesFRecord({
          title: body.title,
          description: body.description,
          tags: body.tags,
        });

        const location = new URL(
          `/api/routes-f/items/${newRecord.id}`,
          request.url
        ).toString();

        const headers = new Headers();
        headers.set("Location", location);

        return jsonResponse(newRecord, {
          status: 201,
          headers,
        });
      } catch (error: any) {
        if (error?.message === "invalid-payload") {
          return jsonResponse(
            {
              error: "Unprocessable Entity",
              message: "Missing title or description",
            },
            { status: 422 }
          );
        }

        return jsonResponse(
          { error: "Internal Server Error" },
          { status: 500 }
        );
      }
    });
  });
}