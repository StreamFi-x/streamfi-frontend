import { NextRequest, NextResponse } from "next/server";

interface Snapshot {
  stream_id: string;
  playback_id: string;
  timestamp: number;
  snapshot_url: string;
  captured_at: string;
}

// In-memory store for snapshots, keyed by stream_id
const snapshotStore = new Map<string, Snapshot[]>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const snapshots = snapshotStore.get(streamId) || [];

  // Return last 10 snapshots
  const last10 = snapshots.slice(-10);

  return NextResponse.json({ snapshots: last10 });
}

export async function POST(req: NextRequest) {
  let body: {
    stream_id?: unknown;
    playback_id?: unknown;
    timestamp?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id, playback_id, timestamp } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required and must be a string" },
      { status: 400 }
    );
  }

  if (!playback_id || typeof playback_id !== "string") {
    return NextResponse.json(
      { error: "playback_id is required and must be a string" },
      { status: 400 }
    );
  }

  // Validate timestamp if provided
  let ts: number;
  if (timestamp !== undefined) {
    if (typeof timestamp !== "number") {
      return NextResponse.json(
        { error: "timestamp must be a number" },
        { status: 400 }
      );
    }
    ts = timestamp;
  } else {
    ts = Math.floor(Date.now() / 1000);
  }

  // Build the Mux thumbnail URL
  const snapshotUrl = `https://image.mux.com/${playback_id}/thumbnail.jpg?time=${ts}`;

  const snapshot: Snapshot = {
    stream_id,
    playback_id,
    timestamp: ts,
    snapshot_url: snapshotUrl,
    captured_at: new Date().toISOString(),
  };

  // Store snapshot
  const existing = snapshotStore.get(stream_id) || [];
  existing.push(snapshot);
  snapshotStore.set(stream_id, existing);

  return NextResponse.json(
    {
      snapshot_url: snapshotUrl,
      captured_at: snapshot.captured_at,
    },
    { status: 201 }
  );
}
