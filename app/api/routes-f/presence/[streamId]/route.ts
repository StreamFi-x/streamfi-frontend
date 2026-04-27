import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Viewer Presence & Concurrent Viewer Tracking
//
// Storage strategy (in-memory substitute for Redis sorted sets):
//   Map<streamId, Map<viewerId, lastHeartbeatMs>>
//
// Viewers are considered active if their last heartbeat was within 60 seconds.
// Peak viewers are tracked per stream.
// ---------------------------------------------------------------------------

type PresenceEntry = { lastSeen: number };

const presenceStore: Map<string, Map<string, PresenceEntry>> = new Map();
const peakViewersStore: Map<string, number> = new Map();

const STALE_THRESHOLD_MS = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStreamPresence(streamId: string): Map<string, PresenceEntry> {
  if (!presenceStore.has(streamId)) {
    presenceStore.set(streamId, new Map());
  }
  return presenceStore.get(streamId)!;
}

function pruneStale(viewers: Map<string, PresenceEntry>) {
  const cutoff = Date.now() - STALE_THRESHOLD_MS;
  for (const [id, entry] of viewers.entries()) {
    if (entry.lastSeen < cutoff) {
      viewers.delete(id);
    }
  }
}

function countActiveViewers(viewers: Map<string, PresenceEntry>): number {
  const cutoff = Date.now() - STALE_THRESHOLD_MS;
  let count = 0;
  for (const entry of viewers.values()) {
    if (entry.lastSeen >= cutoff) count++;
  }
  return count;
}

function updatePeak(streamId: string, current: number) {
  const existing = peakViewersStore.get(streamId) ?? 0;
  if (current > existing) {
    peakViewersStore.set(streamId, current);
  }
}

// ---------------------------------------------------------------------------
// GET /api/routes-f/presence/[streamId]  — current viewer count + peak
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  const { streamId } = params;
  const viewers = getStreamPresence(streamId);
  pruneStale(viewers);

  const count = countActiveViewers(viewers);
  const peak = peakViewersStore.get(streamId) ?? count;

  return NextResponse.json({ count, peak }, { status: 200 });
}
