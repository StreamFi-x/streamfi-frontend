import { DEFAULT_ALLOWED_CATEGORIES, TagCategory, TagPolicy } from "./types";

const policies = new Map<string, TagPolicy>();

export function getPolicy(creatorId: string): TagPolicy {
  const stored = policies.get(creatorId);
  if (stored) {
    return stored;
  }

  return {
    creator_id: creatorId,
    allowed_categories: [...DEFAULT_ALLOWED_CATEGORIES],
    updated_at: new Date(0).toISOString(),
  };
}

export function setPolicy(
  creatorId: string,
  allowedCategories: TagCategory[]
): TagPolicy {
  const policy: TagPolicy = {
    creator_id: creatorId,
    allowed_categories: [...new Set(allowedCategories)],
    updated_at: new Date().toISOString(),
  };
  policies.set(creatorId, policy);
  return policy;
}

export function clearPolicies(): void {
  policies.clear();
}
