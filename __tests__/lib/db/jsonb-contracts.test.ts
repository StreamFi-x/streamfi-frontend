/**
 * @jest-environment node
 */
import {
  JsonbContractError,
  buildNotification,
  classifyCreator,
  classifyNotifications,
  classifySocialLinks,
  isMergeableCreator,
  prepareCreator,
  prepareCreatorPatch,
  prepareSocialLinks,
  readNotifications,
} from "@/lib/db/jsonb-contracts";

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(JsonbContractError);
    return (err as JsonbContractError).issues;
  }
  throw new Error("expected JsonbContractError");
}

describe("socialLinks contract", () => {
  it("accepts the current {platform: url} map", () => {
    expect(
      prepareSocialLinks({ twitter: "https://x.com/a", other: "http://a.io" })
    ).toEqual({ twitter: "https://x.com/a", other: "http://a.io" });
  });

  it("normalises the legacy [{socialTitle, socialLink}] array", () => {
    expect(
      prepareSocialLinks([
        { socialTitle: "Twitter", socialLink: "https://twitter.com/a" },
        { socialTitle: "IG", socialLink: "https://instagram.com/a" },
      ])
    ).toEqual({
      twitter: "https://twitter.com/a",
      instagram: "https://instagram.com/a",
    });
  });

  it("normalises the legacy [{platform, url}] array and the [] default", () => {
    expect(
      prepareSocialLinks([{ platform: "Discord", url: "https://discord.gg/a" }])
    ).toEqual({ discord: "https://discord.gg/a" });
    expect(prepareSocialLinks([])).toEqual({});
  });

  it("rejects a legacy array that would lose a link on conversion", () => {
    expect(
      issuesOf(() =>
        prepareSocialLinks([
          { socialTitle: "a", socialLink: "https://x.com/a" },
          { socialTitle: "b", socialLink: "https://twitter.com/b" },
        ])
      )
    ).toEqual(["(root): more than one link for the same platform"]);
  });

  it("rejects non-http URLs, including javascript: links", () => {
    expect(
      issuesOf(() => prepareSocialLinks({ twitter: "javascript:alert(1)" }))
    ).toEqual(["twitter: must be an http(s) URL"]);
    expect(() => prepareSocialLinks({ twitter: "x.com/a" })).toThrow(
      JsonbContractError
    );
  });

  it("rejects wrong primitive types and malformed nested values", () => {
    expect(() => prepareSocialLinks({ twitter: 5 })).toThrow(
      JsonbContractError
    );
    expect(() => prepareSocialLinks("not json")).toThrow(JsonbContractError);
    expect(() => prepareSocialLinks([{ url: "https://a" }])).toThrow(
      JsonbContractError
    );
    expect(() => prepareSocialLinks(42)).toThrow(JsonbContractError);
  });

  it("decodes a double-encoded document", () => {
    expect(prepareSocialLinks(JSON.stringify({ x: "https://x.com" }))).toEqual({
      x: "https://x.com",
    });
  });
});

describe("creator contract", () => {
  const valid = {
    streamTitle: "Speedrun",
    description: "",
    category: "Gaming",
    tags: ["rpg"],
    payout: "",
    thumbnail: "",
    lastUpdated: "2026-09-25T10:00:00.000Z",
  };

  it("accepts the documents written by registration and stream routes", () => {
    expect(prepareCreator(valid)).toEqual(valid);
    expect(
      prepareCreator({
        streamTitle: "",
        tags: [],
        category: "",
        payout: "",
        thumbnail: "",
      })
    ).toBeTruthy();
  });

  it("keeps deprecated keys readable (legacy title / socialLinks)", () => {
    expect(
      prepareCreator({
        title: "Old title",
        socialLinks: { twitter: "https://x.com/a" },
      })
    ).toEqual({
      title: "Old title",
      socialLinks: { twitter: "https://x.com/a" },
    });
  });

  it("rejects unknown keys (typos) and wrong types", () => {
    expect(issuesOf(() => prepareCreator({ streamTitel: "x" }))[0]).toMatch(
      /Unrecognized key/
    );
    expect(() => prepareCreator({ tags: "a,b" })).toThrow(JsonbContractError);
    expect(() => prepareCreator({ tags: [1] })).toThrow(JsonbContractError);
    expect(() => prepareCreator({ streamTitle: 5 })).toThrow(
      JsonbContractError
    );
    expect(() => prepareCreator({ lastUpdated: "yesterday" })).toThrow(
      JsonbContractError
    );
    expect(() => prepareCreator([])).toThrow(JsonbContractError);
  });

  it("drops undefined values instead of storing them", () => {
    expect(prepareCreator({ streamTitle: "a", category: undefined })).toEqual({
      streamTitle: "a",
    });
  });

  it("validates partial updates without requiring a full document", () => {
    expect(prepareCreatorPatch({ streamTitle: "New" })).toEqual({
      streamTitle: "New",
    });
    expect(() => prepareCreatorPatch({ title: "deprecated" } as never)).toThrow(
      JsonbContractError
    );
    expect(() =>
      prepareCreatorPatch({ tags: "x" } as unknown as { tags: string[] })
    ).toThrow(JsonbContractError);
  });

  it("only merges patches into NULL or an object", () => {
    expect(isMergeableCreator(null)).toBe(true);
    expect(isMergeableCreator(undefined)).toBe(true);
    expect(isMergeableCreator({ a: 1 })).toBe(true);
    expect(isMergeableCreator([])).toBe(false);
    expect(isMergeableCreator("{}")).toBe(false);
  });
});

describe("notifications contract", () => {
  it("builds a valid element", () => {
    const n = buildNotification(
      "follow",
      "New follower",
      "a followed you",
      new Date("2026-09-25T00:00:00Z")
    );
    expect(n).toMatchObject({
      type: "follow",
      title: "New follower",
      text: "a followed you",
      read: false,
      created_at: "2026-09-25T00:00:00.000Z",
    });
    expect(n.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects unknown types and empty text", () => {
    expect(() => buildNotification("mention" as never, "t", "x")).toThrow(
      JsonbContractError
    );
    expect(() => buildNotification("live", "", "x")).toThrow(
      JsonbContractError
    );
  });

  it("reads current and legacy elements into one shape and skips junk", () => {
    const current = buildNotification("live", "Live", "x is live");
    const { notifications, skipped } = readNotifications([
      { title: "Old", text: "legacy" },
      "junk",
      current,
    ]);
    expect(skipped).toBe(1);
    expect(notifications[0]).toMatchObject({
      type: "legacy",
      title: "Old",
      read: true,
      created_at: null,
    });
    expect(notifications[0].id).toMatch(/^legacy-[0-9a-f]{32}$/);
    expect(notifications[1]).toEqual(current);
  });

  it("gives legacy elements a stable id across reads", () => {
    const stored = [{ title: "Old", text: "legacy" }];
    expect(readNotifications(stored).notifications[0].id).toBe(
      readNotifications(stored).notifications[0].id
    );
  });

  it("treats a missing column as empty", () => {
    expect(readNotifications(null)).toEqual({ notifications: [], skipped: 0 });
  });
});

describe("audit classification", () => {
  it("classifies socialLinks values", () => {
    expect(classifySocialLinks({ x: "https://x.com" }).classification).toBe(
      "valid"
    );
    expect(classifySocialLinks(null).classification).toBe("valid");
    const legacy = classifySocialLinks([
      { socialTitle: "t", socialLink: "https://t.me/a" },
    ]);
    expect(legacy).toMatchObject({
      classification: "normalizable",
      canonical: { telegram: "https://t.me/a" },
    });
    expect(
      classifySocialLinks([
        { socialTitle: "a", socialLink: "https://x.com/a" },
        { socialTitle: "b", socialLink: "https://x.com/b" },
      ]).classification
    ).toBe("legacy");
    expect(classifySocialLinks({ x: "ftp://x" }).classification).toBe(
      "nonconforming"
    );
    expect(
      classifySocialLinks(JSON.stringify({ x: "https://x.com" }))
    ).toMatchObject({ classification: "normalizable" });
    expect(classifySocialLinks("garbage").classification).toBe("invalid");
    expect(classifySocialLinks({ x: 1 }).classification).toBe("invalid");
  });

  it("classifies creator values", () => {
    expect(classifyCreator({ streamTitle: "a" }).classification).toBe("valid");
    expect(
      classifyCreator({ streamTitle: "a", thumbnail: null })
    ).toMatchObject({
      classification: "normalizable",
      canonical: { streamTitle: "a" },
    });
    expect(classifyCreator({ unknownKey: 1 }).classification).toBe(
      "nonconforming"
    );
    expect(classifyCreator({ tags: "a,b" }).classification).toBe("invalid");
    expect(classifyCreator([]).classification).toBe("invalid");
  });

  it("classifies notifications and locates invalid elements", () => {
    const current = buildNotification("follow", "t", "x");
    expect(classifyNotifications([current]).classification).toBe("valid");
    expect(
      classifyNotifications([current, { title: "a", text: "b" }]).classification
    ).toBe("legacy");
    expect(
      classifyNotifications([{ ...current, type: "unknown" }]).classification
    ).toBe("nonconforming");
    expect(
      classifyNotifications([current, "junk", { title: 1, text: "x" }])
    ).toMatchObject({ classification: "invalid", invalidIndexes: [1, 2] });
    expect(classifyNotifications({}).classification).toBe("invalid");
  });
});
