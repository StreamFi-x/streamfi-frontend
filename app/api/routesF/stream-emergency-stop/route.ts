import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const STOP_REASONS = ["technical", "safety", "compliance", "other"] as const;

export type StopReason = (typeof STOP_REASONS)[number];

/** Bundled seed of streams that are currently live and stoppable. */
export const ACTIVE_STREAMS = ["s501", "s502", "s503", "s777"] as const;

interface StreamEndEvent {
  stream_id: string;
  reason: StopReason;
  initiator_id: string;
  ended_at: string;
}

type StopResponse = {
  stream_id: string;
  ended_at: string;
  already_ended: boolean;
};

// Module-level event log: one authoritative end event per stream, plus an
// append-only log a moderation dashboard would read.
const endedStreams = new Map<string, StreamEndEvent>();
const eventLog: StreamEndEvent[] = [];

/** Read-only view of the event log, for tests and future dashboards. */
export function __getEventLog(): readonly StreamEndEvent[] {
  return eventLog;
}

/** Test hook: reset state between test cases. */
export function __resetEmergencyStopState(): void {
  endedStreams.clear();
  eventLog.length = 0;
}

const bodySchema = z.object({
  stream_id: z.string().min(1, "stream_id is required"),
  reason: z.enum(STOP_REASONS),
  initiator_id: z.string().min(1, "initiator_id is required"),
});

export async function POST(
  req: NextRequest
): Promise<NextResponse<StopResponse | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(raw);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { stream_id, reason, initiator_id } = validation.data;

  if (!(ACTIVE_STREAMS as readonly string[]).includes(stream_id)) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  // Idempotent: the first stop wins and is the single source of truth.
  // Repeated calls (double-click, retry, two moderators at once) return the
  // original ended_at and are not logged as new events.
  const existing = endedStreams.get(stream_id);
  if (existing) {
    return NextResponse.json({
      stream_id,
      ended_at: existing.ended_at,
      already_ended: true,
    });
  }

  const event: StreamEndEvent = {
    stream_id,
    reason,
    initiator_id,
    ended_at: new Date().toISOString(),
  };
  endedStreams.set(stream_id, event);
  eventLog.push(event);

  return NextResponse.json({
    stream_id,
    ended_at: event.ended_at,
    already_ended: false,
  });
}
