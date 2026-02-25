import { NextResponse } from "next/server";
import { listRoutesFRecords, createRoutesFRecord } from "@/lib/routes-f/store";

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
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes-f
 * Create a new record
 */
export async function POST(req: Request) {
  let body;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  try {
    const newRecord = createRoutesFRecord({
      title: body.title,
      description: body.description,
      tags: body.tags,
    });

    const location = new URL(
      `/api/routes-f/items/${newRecord.id}`,
      req.url
    ).toString();

    const headers = new Headers();
    headers.set("Location", location);

    return NextResponse.json(newRecord, {
      status: 201,
      headers,
    });
  } catch (error: any) {
    if (error?.message === "invalid-payload") {
      return NextResponse.json(
        {
          error: "Unprocessable Entity",
          message: "Missing title or description",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}