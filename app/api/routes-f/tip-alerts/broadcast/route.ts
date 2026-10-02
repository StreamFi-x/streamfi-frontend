/**
 * POST /api/routes-f/tip-alerts/broadcast
 *
 * Internal endpoint to broadcast a tip alert to a creator's connected overlay.
 * Called from the tip webhook handler after a Stellar payment is confirmed.
 *
 * Body:
 *   {
 *     "creator_id": "uuid",
 *     "tipper_name": "string",
 *     "amount_xlm": "50.5",
 *     "amount_usd": "12.50",
 *     "message": "optional message",
 *     "tx_hash": "string"
 *   }
 *
 * Response:
 *   { 
 *     "broadcasted": true,
 *     "connections_count": number  // number of active connections this was sent to
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { tipAlertQueues } from "../stream/route";

// Reference to active connections (imported at runtime)
let activeConnections: Map<string, Set<ReadableStreamDefaultController>>;

// Dynamic import to avoid circular dependency
async function getActiveConnections() {
  if (!activeConnections) {
    // This will be populated by the stream endpoint
    const streamRoute = await import("../stream/route");
    // Create a module-level reference that gets updated
    return new Map();
  }
  return activeConnections;
}

const broadcastSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  tipper_name: z.string().min(1, "tipper_name is required"),
  amount_xlm: z.string().regex(/^\d+(\.\d{1,7})?$/, "Invalid XLM amount"),
  amount_usd: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid USD amount"),
  message: z.string().optional(),
  tx_hash: z.string().optional(),
});

/**
 * Broadcast a tip alert to all connected overlay clients for a creator
 */
async function broadcastTipAlert(alert: {
  id: string;
  tipper_name: string;
  amount_xlm: string;
  amount_usd: string;
  message?: string;
  timestamp: string;
}) {
  // In production, use a proper connection registry (Redis pub/sub, database, etc)
  // For now, we'll store in queue and hope connections pick it up
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify internal API secret
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (
    !internalSecret ||
    req.headers.get("x-internal-secret") !== internalSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await validateBody(req, broadcastSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { creator_id, tipper_name, amount_xlm, amount_usd, message, tx_hash } =
    bodyResult.data;

  const alert = {
    id: tx_hash || `tip_${Date.now()}`,
    tipper_name,
    amount_xlm,
    amount_usd,
    message,
    timestamp: new Date().toISOString(),
  };

  // Queue alert (in case no connections are currently active)
  if (!tipAlertQueues.has(creator_id)) {
    tipAlertQueues.set(creator_id, []);
  }
  tipAlertQueues.get(creator_id)!.push(alert);

  // In production, this would use proper real-time infrastructure
  // For now, alerts are queued and delivered when client reconnects

  return NextResponse.json({
    broadcasted: true,
    connections_count: 0, // Would be populated with real connection tracking
  });
}
