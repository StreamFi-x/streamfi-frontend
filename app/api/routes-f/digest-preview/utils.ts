import type { DigestOptIns, DigestSection } from "./types";
import {
  followedLiveItems,
  newStreamsItems,
  recommendedItems,
  getTipsRecapItems,
} from "./seedData";

const SECTION_TITLES: Record<
  Exclude<keyof DigestOptIns, "viewer_id">,
  string
> = {
  followed_live: "Live now from creators you follow",
  new_streams: "New streams this week",
  tips_recap: "Your tips recap",
  recommended: "Recommended for you",
};

// Sections only appear when the viewer has opted in to that category,
// in a fixed, deterministic order.
export function buildSections(optIns: DigestOptIns): DigestSection[] {
  const sections: DigestSection[] = [];

  if (optIns.followed_live) {
    sections.push({
      title: SECTION_TITLES.followed_live,
      items: followedLiveItems,
    });
  }
  if (optIns.new_streams) {
    sections.push({
      title: SECTION_TITLES.new_streams,
      items: newStreamsItems,
    });
  }
  if (optIns.tips_recap) {
    sections.push({
      title: SECTION_TITLES.tips_recap,
      items: getTipsRecapItems(optIns.viewer_id),
    });
  }
  if (optIns.recommended) {
    sections.push({
      title: SECTION_TITLES.recommended,
      items: recommendedItems,
    });
  }

  return sections;
}

const DAILY_SEND_HOUR_UTC = 9;

// Next occurrence of the daily 09:00 UTC digest send, as an ISO string.
export function getNextScheduledSend(now: Date = new Date()): string {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      DAILY_SEND_HOUR_UTC,
      0,
      0,
      0
    )
  );

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.toISOString();
}
