import type { CreatorNode } from "./types";

/**
 * Seed graph + category data for the similarity recommender.
 *
 * Follower sets are intentionally overlapping so the Jaccard computation has
 * meaningful structure: e.g. creator_a and creator_b share several followers
 * and a category, while creator_e is a near-isolated outlier.
 */
export const creatorGraph: CreatorNode[] = [
  {
    creator_id: "creator_a",
    name: "PixelQueen",
    categories: ["gaming", "esports"],
    followers: ["v1", "v2", "v3", "v4", "v5", "v6"],
  },
  {
    creator_id: "creator_b",
    name: "ClutchKing",
    categories: ["gaming", "esports", "irl"],
    followers: ["v1", "v2", "v3", "v7", "v8"],
  },
  {
    creator_id: "creator_c",
    name: "SpeedRunSam",
    categories: ["gaming", "speedrun"],
    followers: ["v2", "v4", "v9", "v10"],
  },
  {
    creator_id: "creator_d",
    name: "ChainTalk",
    categories: ["crypto", "education"],
    followers: ["v5", "v11", "v12", "v13"],
  },
  {
    creator_id: "creator_e",
    name: "ArtByMona",
    categories: ["art", "irl"],
    followers: ["v20", "v21"],
  },
  {
    creator_id: "creator_f",
    name: "LoFiBeats",
    categories: ["music", "irl"],
    followers: ["v8", "v21", "v22", "v23"],
  },
  {
    creator_id: "creator_g",
    name: "TacticalTina",
    categories: ["gaming", "esports", "education"],
    followers: ["v1", "v3", "v9", "v14", "v15"],
  },
];

export function getCreator(creatorId: string): CreatorNode | undefined {
  return creatorGraph.find(c => c.creator_id === creatorId);
}
