import { NextRequest, NextResponse } from "next/server";

export interface Ban {
  creator_id: string;
  viewer_id: string;
  reason: string;
  ts: number;
}

// In-memory store for practice implementation
let bans: Ban[] = [];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const userBans = bans.filter((ban) => ban.creator_id === creatorId);
  return NextResponse.json({ bans: userBans }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator_id, viewer_id, reason } = body;

    if (!creator_id || !viewer_id || !reason) {
      return NextResponse.json(
        { error: "creator_id, viewer_id, and reason are required" },
        { status: 400 }
      );
    }

    // Check if ban already exists
    const existingBanIndex = bans.findIndex(
      (b) => b.creator_id === creator_id && b.viewer_id === viewer_id
    );

    const ts = Date.now();
    const newBan: Ban = { creator_id, viewer_id, reason, ts };

    if (existingBanIndex >= 0) {
      bans[existingBanIndex] = newBan;
    } else {
      bans.push(newBan);
    }

    return NextResponse.json({ ban: newBan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const creatorId = searchParams.get("creator_id");
  const viewerId = searchParams.get("viewer_id");

  if (!creatorId || !viewerId) {
    return NextResponse.json(
      { error: "creator_id and viewer_id are required" },
      { status: 400 }
    );
  }

  const initialLength = bans.length;
  bans = bans.filter(
    (ban) => !(ban.creator_id === creatorId && ban.viewer_id === viewerId)
  );

  if (bans.length === initialLength) {
    return NextResponse.json({ error: "Ban not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// For testing purposes
export function _resetBans() {
  bans = [];
}
