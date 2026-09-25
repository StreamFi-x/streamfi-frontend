import { GET, PUT } from "./route";
import { POST as CHECK_TAG } from "../check-tag/route";
import { clearPolicies } from "./store";
import { DEFAULT_ALLOWED_CATEGORIES } from "./types";
import { categoryForTag, normalizeTag } from "./tag-map";

const POLICY_URL = "http://localhost/api/routesF/tag-policy";
const CHECK_URL = "http://localhost/api/routesF/check-tag";

function getRequest(query = "") {
  return new Request(`${POLICY_URL}${query}`, { method: "GET" });
}

function putRequest(body: unknown) {
  return new Request(POLICY_URL, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function checkRequest(body: unknown) {
  return new Request(CHECK_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/tag-policy", () => {
  beforeEach(() => {
    clearPolicies();
  });

  describe("GET", () => {
    it("returns the default policy for a creator with no stored policy", async () => {
      const response = await GET(getRequest("?creator_id=creator_123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed_categories).toEqual(DEFAULT_ALLOWED_CATEGORIES);
      expect(data.allowed_categories).not.toContain("mature");
    });

    it("returns a stored policy", async () => {
      await PUT(
        putRequest({
          creator_id: "creator_123",
          allowed_categories: ["family", "gaming"],
        })
      );

      const response = await GET(getRequest("?creator_id=creator_123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed_categories).toEqual(["family", "gaming"]);
    });

    it("returns 400 when creator_id is missing", async () => {
      const response = await GET(getRequest());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("creator_id");
    });

    it("keeps policies isolated per creator", async () => {
      await PUT(
        putRequest({ creator_id: "creator_a", allowed_categories: ["family"] })
      );
      await PUT(
        putRequest({ creator_id: "creator_b", allowed_categories: ["mature"] })
      );

      const a = await (await GET(getRequest("?creator_id=creator_a"))).json();
      const b = await (await GET(getRequest("?creator_id=creator_b"))).json();

      expect(a.allowed_categories).toEqual(["family"]);
      expect(b.allowed_categories).toEqual(["mature"]);
    });
  });

  describe("PUT", () => {
    it("updates the policy and reports the update timestamp", async () => {
      const response = await PUT(
        putRequest({
          creator_id: "creator_123",
          allowed_categories: ["gaming", "esports", "mature"],
        })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.allowed_categories).toEqual(["gaming", "esports", "mature"]);
      expect(Number.isNaN(Date.parse(data.updated_at))).toBe(false);
    });

    it("accepts an empty allow-list", async () => {
      const response = await PUT(
        putRequest({ creator_id: "creator_123", allowed_categories: [] })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed_categories).toEqual([]);
    });

    it("de-duplicates repeated categories", async () => {
      const response = await PUT(
        putRequest({
          creator_id: "creator_123",
          allowed_categories: ["gaming", "gaming", "music"],
        })
      );
      const data = await response.json();

      expect(data.allowed_categories).toEqual(["gaming", "music"]);
    });

    it("overwrites an existing policy", async () => {
      await PUT(
        putRequest({
          creator_id: "creator_123",
          allowed_categories: ["family"],
        })
      );

      const response = await PUT(
        putRequest({
          creator_id: "creator_123",
          allowed_categories: ["crypto"],
        })
      );
      const data = await response.json();

      expect(data.allowed_categories).toEqual(["crypto"]);
    });

    it("rejects unknown categories", async () => {
      const response = await PUT(
        putRequest({
          creator_id: "creator_123",
          allowed_categories: ["gaming", "not_a_category"],
        })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("not_a_category");
    });

    it("rejects a non-array allowed_categories", async () => {
      const response = await PUT(
        putRequest({ creator_id: "creator_123", allowed_categories: "gaming" })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("allowed_categories");
    });

    it("rejects a missing creator_id", async () => {
      const response = await PUT(
        putRequest({ allowed_categories: ["gaming"] })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("creator_id");
    });

    it("rejects a blank creator_id", async () => {
      const response = await PUT(
        putRequest({ creator_id: "   ", allowed_categories: ["gaming"] })
      );

      expect(response.status).toBe(400);
    });

    it("rejects an invalid JSON body", async () => {
      const response = await PUT(
        new Request(POLICY_URL, { method: "PUT", body: "not json" })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("JSON");
    });
  });
});

describe("tag-map", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeTag("  Just Chatting ")).toBe("just-chatting");
  });

  it("resolves tags to their category", () => {
    expect(categoryForTag("Speedrun")).toBe("gaming");
    expect(categoryForTag("soroban")).toBe("crypto");
    expect(categoryForTag("gambling")).toBe("mature");
  });

  it("returns null for an unmapped tag", () => {
    expect(categoryForTag("underwater-basket-weaving")).toBeNull();
  });
});

describe("/api/routesF/check-tag", () => {
  beforeEach(() => {
    clearPolicies();
  });

  it("allows a tag inside the default policy", async () => {
    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123", tag: "speedrun" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      allowed: true,
      category: "gaming",
      tag: "speedrun",
    });
  });

  it("blocks a mature tag under the default policy", async () => {
    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123", tag: "gambling" })
    );
    const data = await response.json();

    expect(data.allowed).toBe(false);
    expect(data.category).toBe("mature");
  });

  it("allows a mature tag once the policy opts in", async () => {
    await PUT(
      putRequest({
        creator_id: "creator_123",
        allowed_categories: ["mature", "gaming"],
      })
    );

    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123", tag: "18-plus" })
    );
    const data = await response.json();

    expect(data.allowed).toBe(true);
    expect(data.category).toBe("mature");
  });

  it("blocks a previously allowed tag after the policy narrows", async () => {
    await PUT(
      putRequest({ creator_id: "creator_123", allowed_categories: ["family"] })
    );

    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123", tag: "minecraft" })
    );
    const data = await response.json();

    expect(data.allowed).toBe(false);
    expect(data.category).toBe("gaming");
  });

  it("normalizes tag casing and spacing before matching", async () => {
    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123", tag: "  Just Chatting " })
    );
    const data = await response.json();

    expect(data.allowed).toBe(true);
    expect(data.category).toBe("irl");
  });

  it("rejects an unmapped tag with a null category", async () => {
    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123", tag: "not-a-real-tag" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.allowed).toBe(false);
    expect(data.category).toBeNull();
  });

  it("returns 400 when the tag is missing", async () => {
    const response = await CHECK_TAG(
      checkRequest({ creator_id: "creator_123" })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("tag");
  });

  it("returns 400 when creator_id is missing", async () => {
    const response = await CHECK_TAG(checkRequest({ tag: "gaming" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("creator_id");
  });

  it("returns 400 for an invalid JSON body", async () => {
    const response = await CHECK_TAG(
      new Request(CHECK_URL, { method: "POST", body: "{" })
    );

    expect(response.status).toBe(400);
  });
});
