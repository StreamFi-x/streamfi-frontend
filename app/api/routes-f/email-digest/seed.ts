import type { DigestPreferences } from "./types";

export const SEED_PREFS: Record<string, DigestPreferences> = {
  viewer_001: {
    viewer_id: "viewer_001",
    enabled: true,
    day_of_week: "monday",
    sections: ["live_alerts", "tip_summary"],
  },
  viewer_002: {
    viewer_id: "viewer_002",
    enabled: false,
    day_of_week: "friday",
    sections: ["new_clips", "recommendations"],
  },
  viewer_003: {
    viewer_id: "viewer_003",
    enabled: true,
    day_of_week: "wednesday",
    sections: ["live_alerts", "new_clips", "tip_summary", "recommendations"],
  },
};
