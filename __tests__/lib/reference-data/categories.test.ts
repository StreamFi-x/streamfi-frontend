/**
 * @jest-environment node
 *
 * Runs against the real lib/cache (memory backend: no Upstash env in tests),
 * so hits, misses and tag invalidation are the production code paths.
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));

import { sql } from "@vercel/postgres";
import { revalidateTag } from "next/cache";
import { resetAppCacheForTests } from "@/lib/cache";
import { invalidateCategoryCaches } from "@/lib/cache/invalidation";
import {
  findCategoryByTitle,
  getAllCategories,
  searchCategoriesByTag,
  searchCategoriesByTitle,
} from "@/lib/reference-data/categories";

const sqlMock = sql as unknown as jest.Mock;

const gaming = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Gaming",
  description: "Games",
  tags: ["esports", "Gameplay"],
  imageurl: "/g.png",
};
const music = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Music",
  description: null,
  tags: [],
  imageurl: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  resetAppCacheForTests();
  sqlMock.mockResolvedValue({ rows: [gaming, music] });
});

describe("category reference data", () => {
  it("reads the table once, then serves every lookup from the cache", async () => {
    await expect(getAllCategories()).resolves.toEqual([gaming, music]);
    await expect(findCategoryByTitle("gAmInG")).resolves.toEqual(gaming);
    await expect(findCategoryByTitle("missing")).resolves.toBeNull();
    await expect(searchCategoriesByTitle("MUS")).resolves.toEqual([music]);
    await expect(searchCategoriesByTag("gameplay")).resolves.toEqual([gaming]);
    await expect(searchCategoriesByTag("nothing")).resolves.toEqual([]);

    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("costs no query for a burst of distinct type-ahead searches", async () => {
    // A cache key per search string would read the table once per prefix
    // (the navbar searches on every debounced keystroke).
    const prefixes = ["g", "ga", "gam", "gami", "gamin", "gaming", "m", "mu"];
    for (let round = 0; round < 125; round++) {
      await searchCategoriesByTitle(prefixes[round % prefixes.length]);
    }

    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("reloads after a category write purges the tag, and purges the CDN too", async () => {
    await getAllCategories();
    sqlMock.mockResolvedValue({ rows: [gaming] });

    await invalidateCategoryCaches();

    await expect(getAllCategories()).resolves.toEqual([gaming]);
    expect(sqlMock).toHaveBeenCalledTimes(2);
    // Same tag as the responses' Vercel-Cache-Tag: purges CDN copies as well.
    expect(revalidateTag).toHaveBeenCalledWith("categories", { expire: 0 });
  });

  it("reads with a stable total order", async () => {
    await getAllCategories();

    const text = (sqlMock.mock.calls[0][0] as string[]).join("?");
    expect(text).toContain("ORDER BY created_at DESC, id DESC");
  });
});
