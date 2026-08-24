import { randomUUID } from "crypto";
import type {
  BanAppeal,
  CreateAppealInput,
  CreateAppealResult,
  PendingAppealSummary,
  ResolveAppealInput,
} from "./types";

const appeals = new Map<string, BanAppeal>();

export function createAppeal(
  input: CreateAppealInput
): { ok: true; result: CreateAppealResult } | { ok: false; error: string; status: number } {
  const creator_id = input.creator_id.trim();
  const viewer_id = input.viewer_id.trim();
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
  const record: BanAppeal = {
    appeal_id,
    creator_id,
    viewer_id,
    message,
    status: "pending",
    mod_note: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  appeals.set(appeal_id, record);

  return {
    ok: true,
    result: { appeal_id, status: "pending" },
  };
}

export function listPendingAppeals(creator_id: string): PendingAppealSummary[] {
  return Array.from(appeals.values())
    .filter((a) => a.creator_id === creator_id && a.status === "pending")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ appeal_id, viewer_id, message, status, created_at }) => ({
      appeal_id,
      viewer_id,
      message,
      status: status as "pending",
      created_at,
    }));
}

export function resolveAppeal(
  input: ResolveAppealInput
): { ok: true; appeal: BanAppeal } | { ok: false; error: string; status: number } {
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

  const status = input.decision === "accept" ? "accepted" : "rejected";
  const updated: BanAppeal = {
    ...appeal,
    status,
    mod_note: input.mod_note?.trim() || null,
    resolved_at: new Date().toISOString(),
  };

  appeals.set(input.appeal_id, updated);
  return { ok: true, appeal: updated };
}

export function __resetBanAppealsStore(): void {
  appeals.clear();
}
