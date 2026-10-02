import { randomUUID } from "crypto";
import type {
  ModerationAppeal,
  SubmitAppealInput,
  SubmitAppealResult,
} from "./types";

// In-memory store keyed by appeal_id — no DB, matching the other routes-f
// moderation mocks (ban-appeals, ban-sync, mod-team).
const appeals = new Map<string, ModerationAppeal>();

const MAX_MESSAGE_LENGTH = 1000;

export function submitAppeal(
  input: SubmitAppealInput
):
  | { ok: true; result: SubmitAppealResult }
  | { ok: false; error: string; status: number } {
  const creator_id = input.creator_id.trim();
  const viewer_id = input.viewer_id.trim();
  const ban_id = input.ban_id?.trim() || null;
  const message = input.message.trim();

  if (!creator_id || !viewer_id || !message) {
    return {
      ok: false,
      error: "creator_id, viewer_id, and message are required.",
      status: 400,
    };
  }

  if (creator_id === viewer_id) {
    return {
      ok: false,
      error: "A creator cannot submit an appeal against their own channel.",
      status: 400,
    };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      status: 400,
    };
  }

  const existingPending = Array.from(appeals.values()).find(
    (a) =>
      a.creator_id === creator_id &&
      a.viewer_id === viewer_id &&
      a.status === "pending"
  );

  if (existingPending) {
    return {
      ok: false,
      error: "A pending appeal already exists for this viewer on this channel.",
      status: 409,
    };
  }

  const appeal_id = randomUUID();
  const created_at = new Date().toISOString();
  const record: ModerationAppeal = {
    appeal_id,
    creator_id,
    viewer_id,
    ban_id,
    message,
    status: "pending",
    created_at,
  };

  appeals.set(appeal_id, record);

  return {
    ok: true,
    result: { appeal_id, status: "pending", created_at },
  };
}

export function getAppeal(appeal_id: string): ModerationAppeal | undefined {
  return appeals.get(appeal_id);
}

export function __resetModerationAppealStore(): void {
  appeals.clear();
}
