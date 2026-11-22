import {
  CORRELATION_HEADER,
  createCorrelationId,
} from "@/lib/tracing/correlation";

/**
 * Client-side correlation ID for the tipping flow. The tip modal begins a flow
 * when it opens, so the quote request carries the ID. After a successful tip
 * the ID stays reusable for a short grace period so the follow-up totals
 * refresh joins the same action in the server logs.
 */

export const TIP_FLOW_GRACE_MS = 60_000;

let activeId: string | null = null;
let expiresAt: number | null = null;

export function beginTipFlow(): string {
  activeId = createCorrelationId();
  expiresAt = null;
  return activeId;
}

/** Marks the flow as finished; its ID is reusable until the grace period ends. */
export function completeTipFlow(now: number = Date.now()): void {
  if (activeId !== null) {
    expiresAt = now + TIP_FLOW_GRACE_MS;
  }
}

export function endTipFlow(): void {
  activeId = null;
  expiresAt = null;
}

export function getTipFlowId(now: number = Date.now()): string | null {
  if (activeId !== null && expiresAt !== null && now > expiresAt) {
    endTipFlow();
  }
  return activeId;
}

/** Active flow ID, or a fresh one for a standalone action (no flow running). */
export function getTipFlowIdOrNew(now: number = Date.now()): string {
  return getTipFlowId(now) ?? createCorrelationId();
}

/** Fetch headers carrying the tip flow's correlation ID. */
export function tipFlowHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  return { ...headers, [CORRELATION_HEADER]: getTipFlowIdOrNew() };
}
