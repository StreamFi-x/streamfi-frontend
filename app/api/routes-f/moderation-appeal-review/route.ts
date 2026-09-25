/**
 * PATCH /api/routes-f/moderation-appeal-review
 *
 * Moderator-only review of a moderation appeal. A moderator on the appeal's
 * channel (per mod-team) accepts { appealId, outcome, reviewerId, reviewNote? }
 * and records the decision as "upheld" (the original moderation action stands)
 * or "overturned" (the action is reversed).
 *
 * Authorization: the caller must supply reviewerId, and that user must be a
 * registered moderator (any role in mod-team) for the appeal's creator_id.
 * This mirrors the moderator-gate pattern used by DELETE /viewer-badge via
 * badge-revoke (see isModerator in badge-revoke/route.ts).
 *
 * GET   ?creator_id=...                                      → list pending appeals
 * POST  { creator_id, target_user_id, action_type, reason }  → file a new appeal (pending)
 * PATCH { appealId, outcome, reviewerId, reviewNote? }        → moderator review
 */

import { NextRequest, NextResponse } from "next/server";
import { modStore } from "@/app/api/routes-f/mod-team/route";
import {
  createModerationAppeal,
  getModerationAppeal,
  listPendingModerationAppeals,
  reviewModerationAppeal,
} from "./store";
import type { AppealOutcome } from "./types";

const VALID_OUTCOMES: AppealOutcome[] = ["upheld", "overturned"];

function isModerator(userId: string, creatorId: string): boolean {
  return modStore.has(`${creatorId}:${userId}`);
}

// ---------------------------------------------------------------------------
// GET — list pending appeals for a creator's channel
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const creator_id = req.nextUrl.searchParams.get("creator_id")?.trim();

  if (!creator_id) {
    return NextResponse.json(
      { error: "creator_id query parameter is required." },
      { status: 400 }
    );
  }

  const appeals = listPendingModerationAppeals(creator_id);
  return NextResponse.json({ appeals });
}

// ---------------------------------------------------------------------------
// POST — file a new moderation appeal
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    creator_id?: unknown;
    target_user_id?: unknown;
    action_type?: unknown;
    reason?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const creator_id = typeof body.creator_id === "string" ? body.creator_id : "";
  const target_user_id =
    typeof body.target_user_id === "string" ? body.target_user_id : "";
  const action_type = typeof body.action_type === "string" ? body.action_type : "";
  const reason = typeof body.reason === "string" ? body.reason : "";

  const result = createModerationAppeal({
    creator_id,
    target_user_id,
    action_type,
    reason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.result, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH — moderator reviews an appeal (upheld | overturned)
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: {
    appealId?: unknown;
    outcome?: unknown;
    reviewerId?: unknown;
    reviewNote?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const appealId = typeof body.appealId === "string" ? body.appealId.trim() : "";
  const outcome = body.outcome as AppealOutcome;
  const reviewerId = typeof body.reviewerId === "string" ? body.reviewerId.trim() : "";
  const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote : undefined;

  if (!appealId) {
    return NextResponse.json({ error: "appealId is required." }, { status: 400 });
  }

  if (!reviewerId) {
    return NextResponse.json({ error: "reviewerId is required." }, { status: 400 });
  }

  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` },
      { status: 400 }
    );
  }

  // Look up the appeal first so we can authorize against its own creator_id
  // (a moderator's authority is scoped to the channel they moderate).
  const existing = getModerationAppeal(appealId);
  if (!existing) {
    return NextResponse.json({ error: "Appeal not found." }, { status: 404 });
  }

  if (!isModerator(reviewerId, existing.creator_id)) {
    return NextResponse.json(
      { error: "Only moderators of this channel can review appeals." },
      { status: 403 }
    );
  }

  const result = reviewModerationAppeal({
    appeal_id: appealId,
    outcome,
    reviewer_id: reviewerId,
    review_note: reviewNote,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { appeal } = result;
  return NextResponse.json({
    appealId: appeal.appeal_id,
    status: appeal.status,
    outcome: appeal.outcome,
    reviewerId: appeal.reviewer_id,
    reviewNote: appeal.review_note,
    reviewedAt: appeal.reviewed_at,
  });
}
