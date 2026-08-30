/**
 * GET  /api/routes-f/tip-alert?creator_id=<id>  → returns tip alert config
 * PUT  /api/routes-f/tip-alert                   → updates tip alert config
 */
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TipAlertConfig {
  creator_id: string;
  min_amount_usdc: number;
  sound_url?: string;
  animation: "confetti" | "fireworks" | "none";
  duration_seconds: number;
}

// ---------------------------------------------------------------------------
// In-memory storage with defaults factory
// ---------------------------------------------------------------------------
export const store = new Map<string, TipAlertConfig>();

function getOrDefault(creator_id: string): TipAlertConfig {
  if (store.has(creator_id)) {return store.get(creator_id)!;}
  return {
    creator_id,
    min_amount_usdc: 1,
    animation: "confetti",
    duration_seconds: 5,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const creator_id = new URL(req.url).searchParams.get("creator_id");
  if (!creator_id) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  return NextResponse.json(getOrDefault(creator_id));
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    creator_id,
    min_amount_usdc,
    sound_url,
    animation,
    duration_seconds,
  } = body as Record<string, unknown>;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const current = getOrDefault(creator_id);
  const updated: TipAlertConfig = { ...current };

  if (min_amount_usdc !== undefined) {
    if (typeof min_amount_usdc !== "number" || min_amount_usdc < 0) {
      return NextResponse.json({ error: "min_amount_usdc must be a non-negative number" }, { status: 400 });
    }
    updated.min_amount_usdc = min_amount_usdc;
  }

  if (sound_url !== undefined) {
    if (typeof sound_url !== "string") {
      return NextResponse.json({ error: "sound_url must be a string" }, { status: 400 });
    }
    updated.sound_url = sound_url;
  }

  if (animation !== undefined) {
    if (!["confetti", "fireworks", "none"].includes(animation as string)) {
      return NextResponse.json(
        { error: 'animation must be "confetti", "fireworks", or "none"' },
        { status: 400 }
      );
    }
    updated.animation = animation as TipAlertConfig["animation"];
  }

  if (duration_seconds !== undefined) {
    if (
      typeof duration_seconds !== "number" ||
      duration_seconds < 1 ||
      duration_seconds > 30
    ) {
      return NextResponse.json(
        { error: "duration_seconds must be between 1 and 30" },
        { status: 400 }
      );
    }
    updated.duration_seconds = duration_seconds;
  }

  store.set(creator_id, updated);
  return NextResponse.json(updated);
}
