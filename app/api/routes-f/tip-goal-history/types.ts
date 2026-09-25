export type TipGoalStatus = "reached" | "expired" | "cancelled";

export interface TipGoalHistoryEntry {
  goal_id: string;
  creator_id: string;
  goal_usdc: number;
  total_raised_usdc: number;
  status: TipGoalStatus;
  contributors: number;
  started_at: string;
  ended_at: string;
}

export interface TipGoalHistoryResponse {
  goals: TipGoalHistoryEntry[];
}
