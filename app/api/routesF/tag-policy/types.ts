export type TagCategory =
  | "family"
  | "gaming"
  | "esports"
  | "music"
  | "irl"
  | "crypto"
  | "education"
  | "art"
  | "tech"
  | "mature";

export const TAG_CATEGORIES: TagCategory[] = [
  "family",
  "gaming",
  "esports",
  "music",
  "irl",
  "crypto",
  "education",
  "art",
  "tech",
  "mature",
];

/**
 * Categories a creator allows by default when no policy has been stored.
 * Mature tags stay opt-in so a fresh channel never surfaces as mature.
 */
export const DEFAULT_ALLOWED_CATEGORIES: TagCategory[] = TAG_CATEGORIES.filter(
  category => category !== "mature"
);

export interface TagPolicy {
  creator_id: string;
  allowed_categories: TagCategory[];
  updated_at: string;
}

export interface TagPolicyGetResponse {
  allowed_categories: TagCategory[];
}

export interface TagPolicyPutResponse {
  success: boolean;
  allowed_categories: TagCategory[];
  updated_at: string;
}

export interface CheckTagResponse {
  allowed: boolean;
  category: TagCategory | null;
  tag: string;
}

export function isTagCategory(value: unknown): value is TagCategory {
  return (
    typeof value === "string" && TAG_CATEGORIES.includes(value as TagCategory)
  );
}
