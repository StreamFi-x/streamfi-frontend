import { sql } from "@vercel/postgres";
import { CACHE_POLICIES, cacheKey, cacheTags, cached } from "@/lib/cache";

/**
 * Reads of stream_categories reference data (#1417). The whole table is one
 * application-cache entry tagged `categories`; lookups and searches filter it
 * in memory. A handful of rows is cheaper to hold whole than to key per query,
 * and it means a type-ahead search (`?title=` per keystroke) costs no query at
 * all, whereas a key per search string would read the table once per prefix.
 *
 * Writes live in app/api/category/route.ts and call invalidateCategoryCaches(),
 * which purges this entry and the CDN copies tagged `categories`.
 * lib/cache/__tests__/invalidation-coverage.test.ts enforces that.
 */

export interface StreamCategory {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  imageurl: string | null;
}

async function loadAllCategories(): Promise<StreamCategory[]> {
  const { rows } = await sql<StreamCategory>`
    SELECT id, title, description, COALESCE(tags, ARRAY[]::text[]) AS tags, imageurl
    FROM stream_categories
    ORDER BY created_at DESC, id DESC
  `;
  return rows;
}

export function getAllCategories(): Promise<StreamCategory[]> {
  return cached(
    {
      key: cacheKey("categories", "all"),
      tags: [cacheTags.categories()],
      ttlSeconds: CACHE_POLICIES.referenceData.appTtlSeconds,
    },
    loadAllCategories
  );
}

export async function findCategoryByTitle(
  title: string
): Promise<StreamCategory | null> {
  const wanted = title.toLowerCase();
  const categories = await getAllCategories();
  return categories.find(c => c.title.toLowerCase() === wanted) ?? null;
}

export async function searchCategoriesByTitle(
  query: string
): Promise<StreamCategory[]> {
  const needle = query.toLowerCase();
  const categories = await getAllCategories();
  return categories.filter(c => c.title.toLowerCase().includes(needle));
}

export async function searchCategoriesByTag(
  query: string
): Promise<StreamCategory[]> {
  const needle = query.toLowerCase();
  const categories = await getAllCategories();
  return categories.filter(c =>
    c.tags.some(tag => tag.toLowerCase().includes(needle))
  );
}
