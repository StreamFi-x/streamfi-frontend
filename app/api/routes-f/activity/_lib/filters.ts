import type { ActivityFeedFilter, ActivityEventType } from "./types";

const FILTER_TYPE_MAP: Record<
  Exclude<ActivityFeedFilter, "all">,
  ActivityEventType[]
> = {
  tips: ["tip_received", "tip_sent"],
  follows: ["new_follower"],
  streams: ["stream_started", "stream_ended", "recording_ready"],
  gifts: ["gift_received", "gift_sent"],
};

export function typesForFilter(filter: ActivityFeedFilter): ActivityEventType[] | null {
  if (filter === "all") {
    return null;
  }
  return FILTER_TYPE_MAP[filter];
}

export function isValidActivityFeedFilter(value: string): value is ActivityFeedFilter {
  return ["all", "tips", "follows", "streams", "gifts"].includes(value);
}
