import type { CreatorNode, SimilarCreator } from "./types";

/**
 * Jaccard index of two sets: |A ∩ B| / |A ∪ B|.
 * Two empty sets are defined as 0 (no evidence of similarity).
 */
export function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter(item => setB.has(item));
}

function buildReason(
  sharedCategories: string[],
  mutualFollowerCount: number
): string {
  const parts: string[] = [];
  if (sharedCategories.length > 0) {
    parts.push(
      `shares ${sharedCategories.length} ${
        sharedCategories.length === 1 ? "category" : "categories"
      } (${sharedCategories.join(", ")})`
    );
  }
  if (mutualFollowerCount > 0) {
    parts.push(
      `${mutualFollowerCount} mutual ${
        mutualFollowerCount === 1 ? "follower" : "followers"
      }`
    );
  }
  if (parts.length === 0) return "no shared categories or followers";
  return parts.join(" and ");
}

/**
 * Rank every creator other than `target` by combined similarity.
 *
 * similarity_score = jaccard(categories) + jaccard(followers), range 0..2.
 * Results are sorted by score descending, then by creator_id for stable order,
 * and zero-score creators are dropped.
 */
export function rankSimilarCreators(
  target: CreatorNode,
  candidates: CreatorNode[],
  limit: number
): SimilarCreator[] {
  const ranked: SimilarCreator[] = [];

  for (const candidate of candidates) {
    if (candidate.creator_id === target.creator_id) continue;

    const categoryScore = jaccard(target.categories, candidate.categories);
    const followerScore = jaccard(target.followers, candidate.followers);
    const score = categoryScore + followerScore;
    if (score === 0) continue;

    const sharedCategories = intersection(
      target.categories,
      candidate.categories
    );
    const mutualFollowers = intersection(target.followers, candidate.followers);

    ranked.push({
      creator: {
        creator_id: candidate.creator_id,
        name: candidate.name,
        categories: candidate.categories,
      },
      similarity_score: Number(score.toFixed(4)),
      reason: buildReason(sharedCategories, mutualFollowers.length),
    });
  }

  ranked.sort((a, b) => {
    if (b.similarity_score !== a.similarity_score) {
      return b.similarity_score - a.similarity_score;
    }
    return a.creator.creator_id.localeCompare(b.creator.creator_id);
  });

  return ranked.slice(0, limit);
}
