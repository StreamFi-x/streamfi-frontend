export type DigestSection =
  | "live_alerts"
  | "new_clips"
  | "tip_summary"
  | "recommendations";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface DigestPreferences {
  viewer_id: string;
  enabled: boolean;
  day_of_week: DayOfWeek;
  sections: DigestSection[];
}

export interface DigestUpdateRequest {
  viewer_id: string;
  enabled?: boolean;
  day_of_week?: DayOfWeek;
  sections?: DigestSection[];
}
