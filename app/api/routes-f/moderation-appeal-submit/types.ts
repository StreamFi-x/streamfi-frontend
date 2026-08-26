export type AppealStatus = "pending" | "accepted" | "rejected";

export interface ModerationAppeal {
  appeal_id: string;
  creator_id: string;
  viewer_id: string;
  ban_id: string | null;
  message: string;
  status: AppealStatus;
  created_at: string;
}

export interface SubmitAppealInput {
  creator_id: string;
  viewer_id: string;
  ban_id?: string;
  message: string;
}

export interface SubmitAppealResult {
  appeal_id: string;
  status: "pending";
  created_at: string;
}
