export type AppealStatus = "pending" | "accepted" | "rejected";

export type AppealDecision = "accept" | "reject";

export interface BanAppeal {
  appeal_id: string;
  creator_id: string;
  viewer_id: string;
  message: string;
  status: AppealStatus;
  mod_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateAppealInput {
  creator_id: string;
  viewer_id: string;
  message: string;
}

export interface CreateAppealResult {
  appeal_id: string;
  status: "pending";
}

export interface ResolveAppealInput {
  appeal_id: string;
  decision: AppealDecision;
  mod_note?: string;
}

export interface PendingAppealSummary {
  appeal_id: string;
  viewer_id: string;
  message: string;
  status: "pending";
  created_at: string;
}
