export interface CreatorStats {
  creator_id: string;
  display_name: string;
  joined_at: number; // epoch ms
  stream_count: number;
  follower_count: number;
  last_updated: number; // epoch ms
}

export type MilestoneKind =
  | "1_year_anniversary"
  | "2_year_anniversary"
  | "3_year_anniversary"
  | "100th_stream"
  | "500th_stream"
  | "1000th_stream"
  | "100th_follower"
  | "1000th_follower"
  | "10000th_follower";

export interface Milestone {
  kind: MilestoneKind;
  label: string;
  date: string; // ISO date string
  creator_id: string;
  creator_name: string;
}

export interface AnniversaryResponse {
  today: Milestone[];
  upcoming: Milestone[];
  on_date: string; // the date queried
}
