/**
 * First-time custodial wallet funding (#1424) as an explicit state machine,
 * so the wizard can never show two contradictory things at once (e.g.
 * "funded" while a purchase is still pending).
 *
 *   not_applicable            not a custodial wallet, or already funded
 *   eligible                  custodial, never funded; wizard closed
 *   intro                     explaining wallet → XLM → how funding works
 *   funding                   Transak widget open, no order yet
 *   pending                   Transak took an order; XLM not on the ledger yet
 *   success                   the wallet balance confirms the funds arrived
 *   abandoned                 widget closed without an order
 *   failed                    Transak reported the order failed
 *   deferred                  user chose "later"; the entry point stays
 *
 * Honesty rules:
 * - Only a STATUS showing the account funded on the ledger reaches
 *   `success`. Transak's "order successful" means Transak completed its
 *   side; the XLM can still take minutes to arrive, so it leads to `pending`.
 * - While `pending`, starting another purchase is refused unless the
 *   pending order has been waiting long enough to be considered stalled, so
 *   a user is never nudged into paying twice.
 */

export type FundingState =
  | "not_applicable"
  | "eligible"
  | "intro"
  | "funding"
  | "pending"
  | "success"
  | "abandoned"
  | "failed"
  | "deferred";

export const INTRO_STEPS = ["wallet", "xlm", "how"] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

export interface FundingMachine {
  state: FundingState;
  /** Whether the wizard dialog is showing. */
  open: boolean;
  introStep: number;
  /** Set while pending. */
  orderId: string | null;
  pendingSince: number | null;
  /** Pending for longer than the expected delivery time. */
  stalled: boolean;
  /** Transak could not be opened (e.g. not configured). */
  unavailable: boolean;
}

export type FundingEvent =
  /** Server status loaded; `pendingOrder` restores a purchase after reload. */
  | {
      type: "STATUS";
      eligible: boolean;
      funded: boolean;
      deferred: boolean;
      pendingOrder?: { orderId: string | null; since: number } | null;
    }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "DEFER" }
  | { type: "START_FUNDING" }
  | { type: "TRANSAK_UNAVAILABLE" }
  | { type: "ORDER_CREATED"; orderId: string | null; at: number }
  | { type: "ORDER_SUCCESSFUL"; orderId: string | null; at: number }
  | { type: "ORDER_FAILED" }
  | { type: "ORDER_CANCELLED" }
  | { type: "WIDGET_CLOSED" }
  | { type: "PENDING_STALLED" };

export const initialFundingMachine: FundingMachine = {
  state: "not_applicable",
  open: false,
  introStep: 0,
  orderId: null,
  pendingSince: null,
  stalled: false,
  unavailable: false,
};

function toPending(
  m: FundingMachine,
  orderId: string | null,
  at: number
): FundingMachine {
  return {
    ...m,
    state: "pending",
    open: true,
    orderId: orderId ?? m.orderId,
    pendingSince: m.pendingSince ?? at,
    stalled: false,
  };
}

/** States from which a confirmed balance means the onboarding is done. */
const CAN_SUCCEED: FundingState[] = [
  "eligible",
  "intro",
  "funding",
  "pending",
  "abandoned",
  "failed",
  "deferred",
];

export function fundingReducer(
  m: FundingMachine,
  event: FundingEvent
): FundingMachine {
  switch (event.type) {
    case "STATUS": {
      if (event.funded) {
        // The funds arrived (through Transak or from anywhere else).
        if (CAN_SUCCEED.includes(m.state)) {
          return {
            ...m,
            state: "success",
            open: m.open || m.state === "pending",
            stalled: false,
          };
        }
        return m.state === "success"
          ? m
          : { ...initialFundingMachine, state: "not_applicable" };
      }
      if (!event.eligible) {
        return { ...initialFundingMachine, state: "not_applicable" };
      }
      if (m.state !== "not_applicable") {
        return m;
      }
      if (event.pendingOrder) {
        return {
          ...toPending(m, event.pendingOrder.orderId, event.pendingOrder.since),
          open: false,
        };
      }
      return { ...m, state: event.deferred ? "deferred" : "eligible" };
    }

    case "OPEN":
      if (m.state === "eligible" || m.state === "deferred") {
        return { ...m, state: "intro", open: true, introStep: 0 };
      }
      if (m.state === "not_applicable") {
        return m;
      }
      return { ...m, open: true };

    case "CLOSE":
      if (m.state === "intro") {
        return { ...m, state: "deferred", open: false };
      }
      if (m.state === "success") {
        return { ...m, state: "not_applicable", open: false };
      }
      return { ...m, open: false };

    case "NEXT":
      if (m.state !== "intro" || m.introStep >= INTRO_STEPS.length - 1) {
        return m;
      }
      return { ...m, introStep: m.introStep + 1 };

    case "BACK":
      if (m.state !== "intro" || m.introStep === 0) {
        return m;
      }
      return { ...m, introStep: m.introStep - 1 };

    case "DEFER":
      if (
        m.state === "intro" ||
        m.state === "abandoned" ||
        m.state === "failed" ||
        m.state === "eligible"
      ) {
        return { ...m, state: "deferred", open: false };
      }
      return m;

    case "START_FUNDING":
      if (
        m.state === "intro" ||
        m.state === "abandoned" ||
        m.state === "failed" ||
        m.state === "deferred" ||
        m.state === "eligible" ||
        (m.state === "pending" && m.stalled)
      ) {
        return {
          ...m,
          state: "funding",
          open: true,
          orderId: null,
          pendingSince: null,
          stalled: false,
          unavailable: false,
        };
      }
      return m;

    case "TRANSAK_UNAVAILABLE":
      if (m.state === "funding") {
        return { ...m, state: "failed", unavailable: true };
      }
      return m;

    case "ORDER_CREATED":
    case "ORDER_SUCCESSFUL":
      if (m.state === "funding" || m.state === "pending") {
        return toPending(m, event.orderId, event.at);
      }
      return m;

    case "ORDER_FAILED":
      if (m.state === "funding" || m.state === "pending") {
        return {
          ...m,
          state: "failed",
          open: true,
          orderId: null,
          pendingSince: null,
          stalled: false,
          unavailable: false,
        };
      }
      return m;

    case "ORDER_CANCELLED":
      if (m.state === "funding") {
        return { ...m, state: "abandoned", open: true };
      }
      return m;

    case "WIDGET_CLOSED":
      // Closing the widget after paying leaves the order pending.
      if (m.state === "funding") {
        return { ...m, state: "abandoned", open: true };
      }
      return m;

    case "PENDING_STALLED":
      return m.state === "pending" ? { ...m, stalled: true } : m;
  }
}

/** The navbar entry point shows while funding is still to do. */
export function showsEntryPoint(m: FundingMachine): boolean {
  return m.state !== "not_applicable" && m.state !== "success";
}
