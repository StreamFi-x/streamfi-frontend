import type { Rating } from "./types";

// creator_id -> rating
export const ratings = new Map<string, Rating>([
  ["creator-family", "family"],
  ["creator-teen", "teen"],
  ["creator-mature", "mature"],
]);

// creator_id -> Set<viewer_id> who confirmed mature content
export const matureConfirmations = new Map<string, Set<string>>([
  ["creator-mature", new Set(["viewer-verified-1"])],
]);

export const VALID_RATINGS: Rating[] = ["family", "teen", "mature"];

export function getRating(creatorId: string): Rating {
  return ratings.get(creatorId) ?? "family";
}

export function hasConfirmedMature(viewerId: string, creatorId: string): boolean {
  return matureConfirmations.get(creatorId)?.has(viewerId) ?? false;
}
