/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../text-fingerprint/route";
import { fingerprint, normalizeText } from "../text-fingerprint/_lib/helpers";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/text-fingerprint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("normalizeText", () => {
  it("lowercases text", () => {
    expect(normalizeText("Hello World")).toBe("hello world");
  });

  it("strips punctuation and collapses resulting whitespace", () => {
    // comma and ! become spaces → collapse → "hello world"
    expect(normalizeText("hello, world!")).toBe("hello world");
    // apostrophe → space, period → space, collapse → "it s a test"
    expect(normalizeText("it's a test.")).toBe("it s a test");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeText("  foo   bar  ")).toBe("foo bar");
  });
});

describe("fingerprint", () => {
  it("returns a sha256 hex fingerprint and normalized text", () => {
    const result = fingerprint("Hello World");
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.normalized).toBe("hello world");
  });

  it("same fingerprint for texts differing only in word order", () => {
    const a = fingerprint("foo bar baz");
    const b = fingerprint("baz foo bar");
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("same fingerprint for texts differing only in case", () => {
    const a = fingerprint("Hello World");
    const b = fingerprint("hello world");
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("same fingerprint for texts differing only in punctuation and order", () => {
    const a = fingerprint("The quick, brown fox!");
    const b = fingerprint("fox brown quick the");
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("different fingerprint for genuinely different content", () => {
    const a = fingerprint("hello world");
    const b = fingerprint("goodbye world");
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("is idempotent for same input", () => {
    const a = fingerprint("test text");
    const b = fingerprint("test text");
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("handles empty string", () => {
    const result = fingerprint("");
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.normalized).toBe("");
  });
});

describe("POST /api/routes-f/text-fingerprint", () => {
  it("returns fingerprint and normalized for valid text", async () => {
    const res = await POST(makeReq({ text: "Hello World" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("fingerprint");
    expect(data).toHaveProperty("normalized");
    expect(data.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns same fingerprint for order-swapped text", async () => {
    const res1 = await POST(makeReq({ text: "apple banana cherry" }));
    const res2 = await POST(makeReq({ text: "cherry apple banana" }));
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.fingerprint).toBe(d2.fingerprint);
  });

  it("returns 400 for missing text field", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is not a string", async () => {
    const res = await POST(makeReq({ text: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-object body", async () => {
    const res = await POST(makeReq("just a string"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/text-fingerprint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
