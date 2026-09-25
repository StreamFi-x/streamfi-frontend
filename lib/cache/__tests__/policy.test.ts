/**
 * @jest-environment node
 */
import { CACHE_POLICIES } from "../policy";
import { cacheKey, cacheTags } from "../tags";

describe("cache policy table", () => {
  it.each(Object.entries(CACHE_POLICIES))(
    "%s: shared caching matches its Cache-Control",
    (_name, policy) => {
      if (policy.shared) {
        expect(policy.cacheControl).toMatch(/^public,/);
        expect(policy.cacheControl).toMatch(/s-maxage=\d+/);
      } else {
        expect(policy.cacheControl).toMatch(/^private,/);
        expect(policy.cacheControl).not.toMatch(/s-maxage|public/);
      }
    }
  );

  it("never lets private data reach a shared cache", () => {
    for (const name of [
      "adminAggregate",
      "privateAnalytics",
      "privateNoStore",
    ] as const) {
      expect(CACHE_POLICIES[name].shared).toBe(false);
    }
  });

  it("keeps edge TTLs short for data invalidated on write", () => {
    const edgeSeconds = (cc: string) =>
      [...cc.matchAll(/(?:s-maxage|stale-while-revalidate)=(\d+)/g)].reduce(
        (sum, m) => sum + Number(m[1]),
        0
      );
    expect(
      edgeSeconds(CACHE_POLICIES.publicProfile.cacheControl)
    ).toBeLessThanOrEqual(15);
    expect(
      edgeSeconds(CACHE_POLICIES.chatWindow.cacheControl)
    ).toBeLessThanOrEqual(2);
  });
});

describe("cache tags and keys", () => {
  it("normalises usernames so lookups and writes agree", () => {
    expect(cacheTags.userByName("  Alice ")).toBe(
      cacheTags.userByName("alice")
    );
  });

  it("keeps wallets case-sensitive (Stellar keys are exact-match)", () => {
    expect(cacheTags.userByWallet("GABC")).not.toBe(
      cacheTags.userByWallet("gabc")
    );
  });

  it("encodes user input so it cannot forge separators", () => {
    expect(cacheKey("profile", "a:b#c=1")).toBe("profile:a%3Ab%23c%3D1");
    expect(cacheTags.userByName("x|user:name:y=9")).not.toContain("|");
  });
});
