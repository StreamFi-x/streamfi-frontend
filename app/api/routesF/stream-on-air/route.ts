import { NextResponse } from "next/server";
import { durationSeconds, getOnAir, setOnAir } from "./store";
import { OnAirGetResponse, OnAirSetResponse } from "./types";

export async function GET(
  request: Request
): Promise<NextResponse<OnAirGetResponse | { error: string }>> {
  const url = new URL(request.url);
  const creatorId = url.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "Missing required query parameter: creator_id" },
      { status: 400 }
    );
  }

  const state = getOnAir(creatorId);

  if (!state) {
    return NextResponse.json({
      on_air: false,
      since: null,
      duration_seconds: 0,
    });
  }

  return NextResponse.json({
    on_air: state.on_air,
    since: state.since,
    duration_seconds: durationSeconds(state.since),
  });
}

export async function POST(
  request: Request
): Promise<NextResponse<OnAirSetResponse | { error: string }>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, on_air } = (body ?? {}) as {
    creator_id?: unknown;
    on_air?: unknown;
  };

  if (typeof creator_id !== "string" || creator_id.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: creator_id" },
      { status: 400 }
    );
  }

  if (typeof on_air !== "boolean") {
    return NextResponse.json(
      { error: "Field on_air must be a boolean" },
      { status: 400 }
    );
  }

  const { state, changed } = setOnAir(creator_id, on_air);

  return NextResponse.json({
    on_air: state.on_air,
    since: state.since,
    changed,
  });
}
