export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rollout_percent: number; // 0–100
  created_at: string;
  updated_at: string;
}

export interface UpsertBody {
  key?: unknown;
  enabled?: unknown;
  rollout_percent?: unknown;
}
