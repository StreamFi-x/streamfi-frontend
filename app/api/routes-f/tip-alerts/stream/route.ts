/**
 * GET /api/routes-f/tip-alerts/stream?creator_id=<id>&token=<token>
 *
 * Server-Sent Events (SSE) endpoint for real-time tip alerts.
 * Broadcasters use this to stream tip notifications to their OBS/streaming overlay.
 *
 * Query params:
 *   creator_id — required; the creator receiving tips
 *   token      — required; authentication token (scoped per creator)
 *
 * Event format (Server → Client):
 *   event: tip_alert
 *   data: {
 *     "id": "uuid",
 *     "tipper_name": "StellarSam",
 *     "amount_xlm": "50.5",
 *     "amount_usd": "12.50",
 *     "message": "Keep building!",
 *     "timestamp": "2026-09-25T12:00:00Z"
 *   }
 *
 * Error responses:
 *   400 — missing query params
 *   401 — invalid token
 *   404 — creator not found
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  token: z.string().min(1, "token is required"),
});

// In-memory store of active SSE connections per creator
// In production, this would use Redis for multi-instance support
const activeConnections = new Map<string, Set<ReadableStreamDefaultController>>();

// Queue of tip alerts per creator
export const tipAlertQueues = new Map<string, Array<{
  id: string;
  tipper_name: string;
  amount_xlm: string;
  amount_usd: string;
  message?: string;
  timestamp: string;
}>>();

/**
 * Validate creator token (stub - replace with real auth in production)
 */
function validateCreatorToken(creatorId: string, token: string): boolean {
  // In production, verify this token against a database of creator broadcast tokens
  // For now, accept any token for development
  return token.length > 0;
}

/**
 * Format SSE message
 */
function formatSSEMessage(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");
  const token = searchParams.get("token");

  if (!creator_id || !token) {
    return NextResponse.json(
      { error: "creator_id and token are required" },
      { status: 400 }
    );
  }

  // Validate token
  if (!validateCreatorToken(creator_id, token)) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send connection established message
      controller.enqueue(
        new TextEncoder().encode(
          formatSSEMessage("connection", { status: "connected", creator_id })
        )
      );

      // Register connection
      if (!activeConnections.has(creator_id)) {
        activeConnections.set(creator_id, new Set());
      }
      activeConnections.get(creator_id)!.add(controller);

      // Flush any queued alerts
      const queue = tipAlertQueues.get(creator_id);
      if (queue && queue.length > 0) {
        while (queue.length > 0) {
          const alert = queue.shift()!;
          controller.enqueue(
            new TextEncoder().encode(formatSSEMessage("tip_alert", alert))
          );
        }
      }

      // Handle disconnection
      const originalClose = controller.close.bind(controller);
      controller.close = () => {
        const connections = activeConnections.get(creator_id);
        if (connections) {
          connections.delete(controller);
          if (connections.size === 0) {
            activeConnections.delete(creator_id);
          }
        }
        originalClose();
      };
    },

    cancel() {
      // Clean up on client disconnect
      const connections = activeConnections.get(creator_id);
      if (connections) {
        connections.clear();
        activeConnections.delete(creator_id);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
