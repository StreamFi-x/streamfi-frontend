export interface TipGoal {
  goal_id: string;
  creator_id: string;
  goal_usdc: number;
  title?: string;
  ends_at?: string; // ISO string
  created_at: string;
  updated_at: string;
}
