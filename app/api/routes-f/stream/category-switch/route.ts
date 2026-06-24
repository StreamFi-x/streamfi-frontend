import { NextRequest, NextResponse } from "next/server";
import { isValidCategory, VALID_CATEGORIES } from "./categories";
import { addCategorySwitch, getTimeline } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { stream_id, category } = body;

  if (typeof stream_id !== "string" || !stream_id.trim()) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }

  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json(
      { error: "category is required." },
      { status: 400 }
    );
  }

  if (!isValidCategory(category)) {
    return NextResponse.json(
      {
        error: `Unknown category: "${category}". Valid categories: ${VALID_CATEGORIES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const result = addCategorySwitch(stream_id, category);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }

  const timeline = getTimeline(streamId);
  return NextResponse.json({ stream_id: streamId, timeline });
}
