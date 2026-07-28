export interface GoalHistory {
  id: string;
  creator_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  attained: boolean;
  ended_at: string;
}

export interface GoalRateResponse {
  attained: number;
  missed: number;
  attainment_rate_percent: number;
}

export interface GoalRateRequest {
  creator_id: string;
  last_n_goals?: number;
}

export type GoalStatus = 'attained' | 'missed';