import type { Reward } from "./types";

// Deterministic seed catalog. Two creators, a mix of limited and unlimited
// stock, so update behaviour can be exercised without depending on any other
// route having run first.
function seedRewards(): Reward[] {
  return [
    {
      reward_id: "reward_emote",
      creator_id: "creator_a",
      title: "Unlock a Custom Emote",
      cost: 500,
      cooldown: 3600,
      stock: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      reward_id: "reward_shoutout",
      creator_id: "creator_a",
      title: "Shoutout on Stream",
      cost: 1500,
      cooldown: 7200,
      stock: 10,
      updated_at: "2026-01-02T00:00:00.000Z",
    },
    {
      reward_id: "reward_song",
      creator_id: "creator_b",
      title: "Song Request",
      cost: 800,
      cooldown: 1800,
      stock: 25,
      updated_at: "2026-01-03T00:00:00.000Z",
    },
  ];
}

// reward_id -> Reward
export const catalog = new Map<string, Reward>(
  seedRewards().map(r => [r.reward_id, r])
);

// Restore the catalog to its seed state — used by tests between cases.
export function resetCatalog(): void {
  catalog.clear();
  for (const reward of seedRewards()) {
    catalog.set(reward.reward_id, reward);
  }
}
