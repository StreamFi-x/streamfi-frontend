/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { resetStore } from "../store";
import { validateAutoBanPattern } from "../validate-pattern";

function makeGet(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/moderation-auto-ban-regex${query}`
  );
}

function makePut(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/moderation-auto-ban-regex",
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("validateAutoBanPattern", () => {
  it("accepts a well-formed pattern with allowed flags", () => {
    expect(validateAutoBanPattern("^spam_bot_\\d+$", "i")).toEqual({ ok: true });
  });

  it("accepts a pattern with no flags", () => {
    expect(validateAutoBanPattern("free.?nft", undefined)).toEqual({ ok: true });
  });

  it("rejects a non-string pattern", () => {
    const result = validateAutoBanPattern(123, "i");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty pattern", () => {
    const result = validateAutoBanPattern("", "i");
    expect(result.ok).toBe(false);
  });

  it("rejects a pattern over the max length", () => {
    const result = validateAutoBanPattern("a".repeat(201), "");
    expect(result.ok).toBe(false);
    if (!result.ok) {expect(result.error).toContain("200");}
  });

  it("rejects invalid regex syntax", () => {
    const result = validateAutoBanPattern("(unclosed", "");
    expect(result.ok).toBe(false);
    if (!result.ok) {expect(result.error).toMatch(/valid regular expression/);}
  });

  it("rejects disallowed flags", () => {
    const result = validateAutoBanPattern("abc", "g,m");
    expect(result.ok).toBe(false);
  });

  it("rejects the 'm' flag specifically", () => {
    const result = validateAutoBanPattern("abc", "m");
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate flags", () => {
    const result = validateAutoBanPattern("abc", "ii");
    expect(result.ok).toBe(false);
  });

  it("rejects nested-quantifier ReDoS shapes like (a+)+", () => {
    const result = validateAutoBanPattern("(a+)+$", "");
    expect(result.ok).toBe(false);
    if (!result.ok) {expect(result.error).toMatch(/catastrophic backtracking/);}
  });

  it("rejects nested-quantifier ReDoS shapes like (a*)*", () => {
    const result = validateAutoBanPattern("(a*)*", "");
    expect(result.ok).toBe(false);
  });
});

describe("GET /api/routes-f/moderation-auto-ban-regex", () => {
  beforeEach(() => {
    resetStore();
  });

  it("requires creator_id", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns 404 for a creator with no configuration", async () => {
    const res = await GET(makeGet("?creator_id=no_such_creator"));
    expect(res.status).toBe(404);
  });

  it("returns the seeded configuration for creator_001", async () => {
    const res = await GET(makeGet("?creator_id=creator_001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creator_id).toBe("creator_001");
    expect(body.patterns.length).toBeGreaterThan(0);
    expect(body.patterns[0]).toHaveProperty("pattern");
    expect(body.patterns[0]).toHaveProperty("flags");
    expect(body.patterns[0]).toHaveProperty("note");
    expect(body.patterns[0]).toHaveProperty("created_at");
  });
});

describe("PUT /api/routes-f/moderation-auto-ban-regex", () => {
  beforeEach(() => {
    resetStore();
  });

  it("replaces a creator's pattern set", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "^bad_actor_\\d+$", flags: "i", note: "test" }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creator_id).toBe("creator_999");
    expect(body.patterns).toHaveLength(1);
    expect(body.patterns[0].pattern).toBe("^bad_actor_\\d+$");
    expect(body.patterns[0].flags).toBe("i");
    expect(body.patterns[0].note).toBe("test");
  });

  it("defaults flags and note when omitted", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "spam" }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patterns[0].flags).toBe("");
    expect(body.patterns[0].note).toBe("");
  });

  it("allows clearing all patterns with an empty array", async () => {
    const res = await PUT(makePut({ creator_id: "creator_001", patterns: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patterns).toEqual([]);

    const getRes = await GET(makeGet("?creator_id=creator_001"));
    const getBody = await getRes.json();
    expect(getBody.patterns).toEqual([]);
  });

  it("persists changes across GET requests", async () => {
    await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "abc", flags: "", note: "" }],
      })
    );
    const res = await GET(makeGet("?creator_id=creator_999"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patterns).toHaveLength(1);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await PUT(makePut({ patterns: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when patterns is not an array", async () => {
    const res = await PUT(
      makePut({ creator_id: "creator_999", patterns: "not-an-array" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when patterns exceeds the max count", async () => {
    const patterns = Array.from({ length: 26 }, (_, i) => ({
      pattern: `pattern_${i}`,
    }));
    const res = await PUT(makePut({ creator_id: "creator_999", patterns }));
    expect(res.status).toBe(400);
  });

  it("returns 400 with the offending index when a pattern is invalid", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "ok" }, { pattern: "(unclosed" }],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("patterns[1]");
  });

  it("returns 400 when a pattern entry is not an object", async () => {
    const res = await PUT(
      makePut({ creator_id: "creator_999", patterns: ["not-an-object"] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a ReDoS-shaped pattern", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "(a+)+$" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for disallowed flags", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "abc", flags: "m" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/moderation-auto-ban-regex",
      {
        method: "PUT",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when note is not a string", async () => {
    const res = await PUT(
      makePut({
        creator_id: "creator_999",
        patterns: [{ pattern: "abc", note: 123 }],
      })
    );
    expect(res.status).toBe(400);
  });
});
