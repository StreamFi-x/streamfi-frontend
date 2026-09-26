/**
 * GET /api/realtime/events
 *
 * Server-Sent Events (SSE) push streaming endpoint.
 * Connects clients to requested channels, streams new messages with monotonic sequence IDs,
 * and maintains heartbeats.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRealtimeToken } from "@/lib/realtime/tokens";
import {
  getRecentMessages,
  subscribeLocal,
  RealtimeMessage,
} from "@/lib/realtime/pubsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const channelsParam = url.searchParams.get("channels");
  const sinceSeqParam = url.searchParams.get("sinceSeq");

  const requestedChannels = channelsParam
    ? channelsParam.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  if (!token) {
    return NextResponse.json(
      { error: "Missing realtime auth token" },
      { status: 401 }
    );
  }

  const verification = verifyRealtimeToken(token, requestedChannels);
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.reason },
      { status: 403 }
    );
  }

  const allowedChannels =
    requestedChannels.length > 0
      ? requestedChannels
      : verification.payload.channels;

  const sinceSeq = sinceSeqParam ? parseInt(sinceSeqParam, 10) : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 1. Send initial connection established message
      const initPayload = JSON.stringify({
        type: "connected",
        channels: allowedChannels,
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`event: init\ndata: ${initPayload}\n\n`));

      // 2. Replay recent messages if reconnecting with sinceSeq
      if (sinceSeq !== undefined && sinceSeq >= 0) {
        for (const channel of allowedChannels) {
          const recent = await getRecentMessages(channel, sinceSeq);
          for (const msg of recent) {
            controller.enqueue(
              encoder.encode(
                `event: message\ndata: ${JSON.stringify(msg)}\n\n`
              )
            );
          }
        }
      }

      // 3. Subscribe to active channel events
      const unsubs: Array<() => void> = [];
      for (const channel of allowedChannels) {
        const unsub = subscribeLocal(channel, (msg: RealtimeMessage) => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: message\ndata: ${JSON.stringify(msg)}\n\n`
              )
            );
          } catch {
            // Stream closed
          }
        });
        unsubs.push(unsub);
      }

      // 4. Send keep-alive heartbeat every 15s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: ping\ndata: {"timestamp":${Date.now()}}\n\n`)
          );
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubs.forEach((unsub) => unsub());
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
