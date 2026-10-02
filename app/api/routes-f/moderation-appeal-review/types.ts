/**
 * Types for PATCH /api/routes-f/moderation-appeal-review
 */

export type AppealOutcome = "upheld" | "overturned";

export type ModerationAppealStatus = "pending" | "upheld" | "overturned";

export interface ModerationAppeal {
  appeal_id: string;
  creator_id: string;
  target_user_id: string;
  action_type: string;
  reason: string;
  status: ModerationAppealStatus;
  outcome: AppealOutcome | null;
  reviewer_id: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface CreateModerationAppealInput {
  creator_id: string;
  target_user_id: string;
  action_type: string;
  reason: string;
}

export interface CreateModerationAppealResult {
  appeal_id: string;
  status: "pending";
}

export interface ReviewModerationAppealInput {
  appeal_id: string;
  outcome: AppealOutcome;
  reviewer_id: string;
  review_note?: string;
}

export type ReviewModerationAppealResult =
  | { ok: true; appeal: ModerationAppeal }
  | { ok: false; error: string; status: number };
