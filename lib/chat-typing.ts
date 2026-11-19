/**
 * Typing indicators: shared constants, server broadcast policy and the
 * client-side tracker. Typing events travel on the ephemeral
 * `stream:{playbackId}:typing` channel and are never written to
 * `chat_messages`. See docs/chat-typing-indicators.md.
 */

import type { SpikeLevel } from "@/lib/chat-spike";
import { shouldShedTypingIndicators } from "@/lib/chat-spike";

export const TYPING_EVENT = "chat:typing";

export function typingChannel(playbackId: string): string {
  return `stream:${playbackId}:typing`;
}

export type TypingState = "typing" | "stopped";

export interface TypingEventPayload {
  state: TypingState;
  username: string;
  wallet: string;
}

// ── Client timings ──────────────────────────────────────────────────────────

/** Minimum gap between "typing" events from one client while keys are pressed. */
export const TYPING_EMIT_INTERVAL_MS = 2000;
/** A client that stops pressing keys for this long sends "stopped". */
export const TYPING_IDLE_MS = 3000;
/** A remote typist disappears if no update arrives within this window. */
export const TYPING_EXPIRY_MS = 5000;
/** After an explicit "stopped", keep the indicator briefly so quick restarts don't flicker. */
export const TYPING_STOP_GRACE_MS = 1000;
/** At most this many names are listed; beyond it the label becomes a count. */
export const MAX_NAMED_TYPISTS = 2;

// ── Server policy ───────────────────────────────────────────────────────────

/** Up to this many viewers every typing event is broadcast. */
export const TYPING_FULL_BROADCAST_MAX_VIEWERS = 200;
/** Up to this many viewers broadcasts are capped per room; above it typing is disabled. */
export const TYPING_SAMPLED_MAX_VIEWERS = 2000;
/** Room-wide broadcast budget in the sampled tier. */
export const TYPING_SAMPLED_ROOM_LIMIT = 5;
export const TYPING_SAMPLED_ROOM_WINDOW_MS = 1000;
/** Per-user cap: a well-behaved client sends ~1 event / 2 s. */
export const TYPING_USER_LIMIT = 4;
export const TYPING_USER_WINDOW_MS = 5000;

export type TypingSuppression =
  | "load-shed"
  | "viewer-cutoff"
  | "timed-out"
  | "slow-mode"
  | "room-sampled";

export interface TypingPolicyInput {
  state: TypingState;
  spikeLevel: SpikeLevel;
  viewerCount: number;
  isTimedOut: boolean;
  /** Milliseconds until the user may send again under slow mode; 0 if free to send. */
  slowModeRemainingMs: number;
  /** Result of the room-wide budget check; only consulted in the sampled tier. */
  roomBudgetAvailable: boolean;
}

export type TypingDecision =
  | { broadcast: true }
  | { broadcast: false; reason: TypingSuppression };

/**
 * Decides whether a typing event reaches the room.
 *
 * - Critical chat load and rooms above the viewer cutoff get no typing events.
 * - Muted (timed-out) users and users still inside their slow-mode cooldown
 *   never show "typing": they cannot send, so the indicator would mislead.
 *   Suppression applies to "typing" only; a "stopped" event is harmless and
 *   lets viewers clear an indicator that was shown before the restriction.
 * - Mid-size rooms share a small broadcast budget.
 */
export function decideTypingBroadcast(
  input: TypingPolicyInput
): TypingDecision {
  if (shouldShedTypingIndicators(input.spikeLevel)) {
    return { broadcast: false, reason: "load-shed" };
  }
  if (input.viewerCount > TYPING_SAMPLED_MAX_VIEWERS) {
    return { broadcast: false, reason: "viewer-cutoff" };
  }
  if (input.state === "stopped") {
    return { broadcast: true };
  }
  if (input.isTimedOut) {
    return { broadcast: false, reason: "timed-out" };
  }
  if (input.slowModeRemainingMs > 0) {
    return { broadcast: false, reason: "slow-mode" };
  }
  if (
    input.viewerCount > TYPING_FULL_BROADCAST_MAX_VIEWERS &&
    !input.roomBudgetAvailable
  ) {
    return { broadcast: false, reason: "room-sampled" };
  }
  return { broadcast: true };
}

// ── Client-side tracking ────────────────────────────────────────────────────

export interface Typist {
  key: string;
  username: string;
}

interface TrackedTypist extends Typist {
  expiresAt: number;
}

/**
 * Tracks who is currently typing. Entries expire on their own, so a user who
 * closes the tab mid-sentence disappears without an explicit "stopped".
 */
export class TypingTracker {
  private typists = new Map<string, TrackedTypist>();

  constructor(
    private expiryMs: number = TYPING_EXPIRY_MS,
    private stopGraceMs: number = TYPING_STOP_GRACE_MS
  ) {}

  typing(key: string, username: string, now: number): void {
    this.typists.set(key, { key, username, expiresAt: now + this.expiryMs });
  }

  stopped(key: string, now: number): void {
    const existing = this.typists.get(key);
    if (!existing) {
      return;
    }
    existing.expiresAt = Math.min(existing.expiresAt, now + this.stopGraceMs);
  }

  /** Drops a typist immediately, e.g. when their message arrives. */
  remove(key: string): void {
    this.typists.delete(key);
  }

  clear(): void {
    this.typists.clear();
  }

  /** Active typists, oldest first. Prunes expired entries. */
  active(now: number): Typist[] {
    const result: Typist[] = [];
    for (const [key, t] of this.typists) {
      if (t.expiresAt <= now) {
        this.typists.delete(key);
      } else {
        result.push({ key: t.key, username: t.username });
      }
    }
    return result;
  }

  /** Earliest moment `active()` can change on its own, or null when empty. */
  nextExpiry(): number | null {
    let next: number | null = null;
    for (const t of this.typists.values()) {
      if (next === null || t.expiresAt < next) {
        next = t.expiresAt;
      }
    }
    return next;
  }
}

/**
 * "Alice is typing…", "Alice and Bob are typing…", "3 people are typing…".
 * Returns null when nobody is typing.
 */
export function formatTypingLabel(typists: Typist[]): string | null {
  if (typists.length === 0) {
    return null;
  }
  if (typists.length === 1) {
    return `${typists[0].username} is typing…`;
  }
  if (typists.length <= MAX_NAMED_TYPISTS) {
    return `${typists.map(t => t.username).join(" and ")} are typing…`;
  }
  return `${typists.length} people are typing…`;
}
