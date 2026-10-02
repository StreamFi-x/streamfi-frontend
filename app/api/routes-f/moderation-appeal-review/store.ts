import { randomUUID } from "crypto";
import type {
  CreateModerationAppealInput,
  CreateModerationAppealResult,
  ModerationAppeal,
  ReviewModerationAppealInput,
  ReviewModerationAppealResult,
} from "./types";

// In-memory store, keyed by appeal_id. Mirrors the pattern used by the
// ban-appeals module — no DB migration exists yet for moderation appeals.
const appeals = new Map<string, ModerationAppeal>();

export function createModerationAppeal(
  input: CreateModerationAppealInput
):
  | { ok: true; result: CreateModerationAppealResult }
  | { ok: false; error: string; status: number } {
  const creator_id = input.creator_id.trim();
  const target_user_id = input.target_user_id.trim();
  const action_type = input.action_type.trim();
  const reason = input.reason.trim();

  if (!creator_id || !target_user_id || !action_type || !reason) {
    return {
      ok: false,
      error: "creator_id, target_user_id, action_type, and reason are required.",
      status: 400,
    };
  }

  const existingPending = Array.from(appeals.values()).find(
    (a) =>
      a.creator_id === creator_id &&
      a.target_user_id === target_user_id &&
      a.action_type === action_type &&
      a.status === "pending"
  );

  if (existingPending) {
    return {
      ok: false,
      error:
        "A pending appeal already exists for this user and action on this channel.",
      status: 409,
    };
  }

  const appeal_id = randomUUID();
  const record: ModerationAppeal = {
    appeal_id,
    creator_id,
    target_user_id,
    action_type,
    reason,
    status: "pending",
    outcome: null,
    reviewer_id: null,
    review_note: null,
    created_at: new Date().toISOString(),
    reviewed_at: null,
  };

  appeals.set(appeal_id, record);

  return { ok: true, result: { appeal_id, status: "pending" } };
}

export function getModerationAppeal(appeal_id: string): ModerationAppeal | undefined {
  return appeals.get(appeal_id);
}

export function listPendingModerationAppeals(creator_id: string): ModerationAppeal[] {
  return Array.from(appeals.values())
    .filter((a) => a.creator_id === creator_id && a.status === "pending")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function reviewModerationAppeal(
  input: ReviewModerationAppealInput
): ReviewModerationAppealResult {
  const appeal = appeals.get(input.appeal_id);

  if (!appeal) {
    return { ok: false, error: "Appeal not found.", status: 404 };
  }

  if (appeal.status !== "pending") {
    return {
      ok: false,
      error: `Appeal has already been ${appeal.status}.`,
      status: 409,
    };
  }

  const updated: ModerationAppeal = {
    ...appeal,
    status: input.outcome,
    outcome: input.outcome,
    reviewer_id: input.reviewer_id,
    review_note: input.review_note?.trim() || null,
    reviewed_at: new Date().toISOString(),
  };

  appeals.set(input.appeal_id, updated);
  return { ok: true, appeal: updated };
}

export function __resetModerationAppealStore(): void {
  appeals.clear();
}

export function __seedModerationAppeal(appeal: ModerationAppeal): void {
  appeals.set(appeal.appeal_id, appeal);
}
