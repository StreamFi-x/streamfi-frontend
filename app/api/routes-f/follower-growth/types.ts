export type Granularity = "day" | "week" | "month";

export interface FollowEvent {
  creator_id: string;
  follower_id: string;
  /** ISO 8601 timestamp of when the follow happened. */
  followed_at: string;
}

export interface GrowthBucket {
  /** ISO date (YYYY-MM-DD) marking the start of the bucket. */
  bucket_start: string;
  /** Cumulative follower count at the end of this bucket. */
  count: number;
}

export interface FollowerGrowthResponse {
  series: GrowthBucket[];
  total: number;
}
