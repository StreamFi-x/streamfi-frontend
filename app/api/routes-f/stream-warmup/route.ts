import { NextRequest, NextResponse } from "next/server";

// In-memory store keyed by username
const warmupStore = new Map<
  string,
  {
    warmup_active: boolean;
    started_at: string;
    warmup_message?: string;
    teaser_image_url?: string;
  }
>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  const warmup = warmupStore.get(username);

  if (!warmup) {
    return NextResponse.json(
      { error: "Warmup state not found for user" },
      { status: 404 }
    );
  }

  return NextResponse.json(warmup);
}

export async function POST(req: NextRequest) {
  let body: {
    username?: unknown;
    warmup_message?: unknown;
    teaser_image_url?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username, warmup_message, teaser_image_url } = body;

  if (!username || typeof username !== "string") {
    return NextResponse.json(
      { error: "username is required and must be a string" },
      { status: 400 }
    );
  }

  if (warmup_message !== undefined && typeof warmup_message !== "string") {
    return NextResponse.json(
      { error: "warmup_message must be a string" },
      { status: 400 }
    );
  }

  if (teaser_image_url !== undefined && typeof teaser_image_url !== "string") {
    return NextResponse.json(
      { error: "teaser_image_url must be a string" },
      { status: 400 }
    );
  }

  const warmupState = {
    warmup_active: true,
    started_at: new Date().toISOString(),
    ...(warmup_message && { warmup_message }),
    ...(teaser_image_url && { teaser_image_url }),
  };

  warmupStore.set(username, warmupState);

  return NextResponse.json(warmupState, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  let body: { username?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username } = body;

  if (!username || typeof username !== "string") {
    return NextResponse.json(
      { error: "username is required and must be a string" },
      { status: 400 }
    );
  }

  const existed = warmupStore.delete(username);

  if (!existed) {
    return NextResponse.json(
      { error: "Warmup state not found for user" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
