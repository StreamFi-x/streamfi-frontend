/**
 * POST /api/routes-f/stream-heartbeat
 * Streamer encoder posts periodic heartbeats; returns health status.
 */
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HeartbeatSample {
  bitrate_kbps: number;
  fps: number;
  resolution: string;
  dropped_frames: number;
  recorded_at: string;
}

type HealthStatus = "ok" | "degraded" | "critical";

// ---------------------------------------------------------------------------
// In-memory ring buffer — last 60 samples per stream
// ---------------------------------------------------------------------------
const RING_SIZE = 60;
const rings = new Map<string, HeartbeatSample[]>();

function addSample(stream_id: string, sample: HeartbeatSample): void {
  const buf = rings.get(stream_id) ?? [];
  buf.push(sample);
  if (buf.length > RING_SIZE) {buf.shift();}
  rings.set(stream_id, buf);
}

// ---------------------------------------------------------------------------
// Health computation
// ---------------------------------------------------------------------------
const BITRATE_CRITICAL = 500; // kbps
const BITRATE_DEGRADED = 1500; // kbps
const DROP_RATIO_CRITICAL = 0.1; // 10 %
const DROP_RATIO_DEGRADED = 0.03; // 3 %

function computeHealth(
  bitrate_kbps: number,
  fps: number,
  dropped_frames: number
): { health: HealthStatus; recommendations: string[] } {
  const total = fps + dropped_frames; // total frames expected in the period
  const dropRatio = total > 0 ? dropped_frames / total : 0;
  const recommendations: string[] = [];

  let health: HealthStatus = "ok";

  if (bitrate_kbps < BITRATE_CRITICAL || dropRatio >= DROP_RATIO_CRITICAL) {
    health = "critical";
  } else if (bitrate_kbps < BITRATE_DEGRADED || dropRatio >= DROP_RATIO_DEGRADED) {
    health = "degraded";
  }

  if (bitrate_kbps < BITRATE_CRITICAL) {
    recommendations.push("Bitrate is critically low — check upload bandwidth.");
  } else if (bitrate_kbps < BITRATE_DEGRADED) {
    recommendations.push("Bitrate is below recommended — consider lowering resolution.");
  }

  if (dropRatio >= DROP_RATIO_CRITICAL) {
    recommendations.push("High frame drop rate — reduce encoding preset or resolution.");
  } else if (dropRatio >= DROP_RATIO_DEGRADED) {
    recommendations.push("Elevated frame drops detected — monitor CPU usage.");
  }

  return { health, recommendations };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    stream_id,
    bitrate_kbps,
    fps,
    resolution,
    dropped_frames = 0,
  } = body as Record<string, unknown>;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }
  if (typeof bitrate_kbps !== "number" || bitrate_kbps < 0) {
    return NextResponse.json({ error: "bitrate_kbps must be a non-negative number" }, { status: 400 });
  }
  if (typeof fps !== "number" || fps < 0) {
    return NextResponse.json({ error: "fps must be a non-negative number" }, { status: 400 });
  }
  if (!resolution || typeof resolution !== "string") {
    return NextResponse.json({ error: "resolution is required" }, { status: 400 });
  }
  if (typeof dropped_frames !== "number" || dropped_frames < 0) {
    return NextResponse.json({ error: "dropped_frames must be a non-negative number" }, { status: 400 });
  }

  const sample: HeartbeatSample = {
    bitrate_kbps,
    fps,
    resolution,
    dropped_frames,
    recorded_at: new Date().toISOString(),
  };

  addSample(stream_id, sample);

  const { health, recommendations } = computeHealth(bitrate_kbps, fps, dropped_frames);

  return NextResponse.json({ health, recommendations }, { status: 200 });
}

// Export store for tests
export { rings };
