import type { DigestOptIns, DigestItem } from "./types";

// Seeded opt-in preferences per viewer, mirroring realistic mixed-preference scenarios.
export const optInStore: Map<string, DigestOptIns> = new Map([
  [
    "viewer_all_optin",
    {
      viewer_id: "viewer_all_optin",
      followed_live: true,
      new_streams: true,
      tips_recap: true,
      recommended: true,
    },
  ],
  [
    "viewer_mixed_optin",
    {
      viewer_id: "viewer_mixed_optin",
      followed_live: true,
      new_streams: false,
      tips_recap: true,
      recommended: false,
    },
  ],
  [
    "viewer_none_optin",
    {
      viewer_id: "viewer_none_optin",
      followed_live: false,
      new_streams: false,
      tips_recap: false,
      recommended: false,
    },
  ],
]);

export function defaultOptIns(viewer_id: string): DigestOptIns {
  return {
    viewer_id,
    followed_live: true,
    new_streams: true,
    tips_recap: false,
    recommended: true,
  };
}

export function getOptIns(viewer_id: string): DigestOptIns {
  return optInStore.get(viewer_id) ?? defaultOptIns(viewer_id);
}

// Shared content pools — same for every viewer that has the category enabled,
// matching how a real digest would surface platform-wide live/new/recommended content.
export const followedLiveItems: DigestItem[] = [
  {
    id: "live_1",
    title: "nova_streams is live: Ranked Valorant grind",
    subtitle: "1.2k watching",
  },
  {
    id: "live_2",
    title: "chainbeats is live: Lo-fi beats + XLM giveaways",
    subtitle: "340 watching",
  },
];

export const newStreamsItems: DigestItem[] = [
  {
    id: "new_1",
    title: "pixel_forge went live for the first time this week",
    subtitle: "Art & Design",
  },
  {
    id: "new_2",
    title: "stellar_sam started a new series: Crypto 101",
    subtitle: "Education",
  },
  {
    id: "new_3",
    title: "midnight_dao is streaming a subscriber-only AMA",
    subtitle: "Subscribers only",
  },
];

export const recommendedItems: DigestItem[] = [
  {
    id: "rec_1",
    title: "Top clip: nova_streams' clutch ace",
    subtitle: "12.4k views this week",
  },
  {
    id: "rec_2",
    title: "Trending category: Music",
    subtitle: "Based on your watch history",
  },
];

// Per-viewer tips recap items — personalized, so most viewers have none.
export const tipsRecapByViewer: Map<string, DigestItem[]> = new Map([
  [
    "viewer_all_optin",
    [
      {
        id: "tip_1",
        title: "You tipped nova_streams 25 USDC this week",
        subtitle: "3 tips sent",
      },
      {
        id: "tip_2",
        title: "You tipped chainbeats 5 XLM this week",
        subtitle: "1 tip sent",
      },
    ],
  ],
  [
    "viewer_mixed_optin",
    [
      {
        id: "tip_3",
        title: "You tipped pixel_forge 10 USDC this week",
        subtitle: "1 tip sent",
      },
    ],
  ],
]);

export function getTipsRecapItems(viewer_id: string): DigestItem[] {
  return tipsRecapByViewer.get(viewer_id) ?? [];
}
