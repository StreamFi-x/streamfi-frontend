import { NextRequest, NextResponse } from "next/server";

export interface FeaturedMoment {
  featured_id: string;
  vod_id: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  created_at: string;
}

const MAX_FEATURED_PER_VOD = 3;

// In-memory store: key = vod_id, value = featured moments for that VOD.
export const featuredMomentsStore = new Map<string, FeaturedMoment[]>();

let nextId = 1;

function generateFeaturedId(): string {
  return `featured-${nextId++}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const vodId = typeof payload.vod_id === "string" ? payload.vod_id.trim() : null;
  const startSeconds = payload.start_seconds;
  const endSeconds = payload.end_seconds;
  const title = typeof payload.title === "string" ? payload.title.trim() : null;

  if (!vodId) {
    return NextResponse.json({ error: "vod_id is required" }, { status: 400 });
  }
  if (typeof startSeconds !== "number" || !Number.isFinite(startSeconds) || startSeconds < 0) {
    return NextResponse.json(
      { error: "start_seconds must be a non-negative number" },
      { status: 400 }
    );
  }
  if (typeof endSeconds !== "number" || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    return NextResponse.json(
      { error: "end_seconds must be a number greater than start_seconds" },
      { status: 400 }
    );
  }
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const existing = featuredMomentsStore.get(vodId) ?? [];
  if (existing.length >= MAX_FEATURED_PER_VOD) {
    return NextResponse.json(
      { error: `A VOD may have at most ${MAX_FEATURED_PER_VOD} featured moments` },
      { status: 409 }
    );
  }

  const moment: FeaturedMoment = {
    featured_id: generateFeaturedId(),
    vod_id: vodId,
    start_seconds: startSeconds,
    end_seconds: endSeconds,
    title,
    created_at: new Date().toISOString(),
  };

  featuredMomentsStore.set(vodId, [...existing, moment]);

  return NextResponse.json({ featured_id: moment.featured_id }, { status: 201 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const vodId = searchParams.get("vod_id");

  if (!vodId) {
    return NextResponse.json({ error: "vod_id is required" }, { status: 400 });
  }

  const moments = featuredMomentsStore.get(vodId) ?? [];
  return NextResponse.json({ moments });
}
