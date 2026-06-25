export interface RerunConfig {
  creator_id: string;
  vod_id: string | null;
  rerun_active: boolean;
  started_at: string | null;
}

export interface PostRerunBody {
  creator_id: string;
  vod_id: string;
  enabled: boolean;
}

export interface GetRerunResponse {
  rerun_active: boolean;
  vod_id: string | null;
  started_at: string | null;
}
