import { POST, GET } from "../route";
import { NextRequest } from "next/server";

function makeCheckRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/anagram/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeFindRequest(word: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/anagram/find?word=${encodeURIComponent(word)}`, {
    method: "GET",
  });
}

describe("POST /api/routes-f/anagram/check", () => {
  it("listen and silent are anagrams", async () => {
    const res = await POST(makeCheckRequest({ a: "listen", b: "silent" }));
    const data = await res.json();
    expect(data.is_anagram).toBe(true);
  });

  it("evil and vile are anagrams", async () => {
    const res = await POST(makeCheckRequest({ a: "evil", b: "vile" }));
    const data = await res.json();
    expect(data.is_anagram).toBe(true);
  });

  it("dusty and study are anagrams", async () => {
    const res = await POST(makeCheckRequest({ a: "dusty", b: "study" }));
    const data = await res.json();
    expect(data.is_anagram).toBe(true);
  });

  it("is case-insensitive", async () => {
    const res = await POST(makeCheckRequest({ a: "Listen", b: "SILENT" }));
    const data = await res.json();
    expect(data.is_anagram).toBe(true);
  });

  it("ignores whitespace", async () => {
    const res = await POST(makeCheckRequest({ a: "li sten", b: "si lent" }));
    const data = await res.json();
    expect(data.is_anagram).toBe(true);
  });

  it("hello and world are not anagrams", async () => {
    const res = await POST(makeCheckRequest({ a: "hello", b: "world" }));
    const data = await res.json();
    expect(data.is_anagram).toBe(false);
  });

  it("returns 400 when inputs are missing", async () => {
    const res = await POST(makeCheckRequest({ a: "hello" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when input exceeds 30 chars", async () => {
    const res = await POST(makeCheckRequest({ a: "a".repeat(31), b: "b" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/anagram/find", () => {
  it("finds anagrams of listen", async () => {
    const res = await GET(makeFindRequest("listen"));
    const data = await res.json();
    expect(Array.isArray(data.anagrams)).toBe(true);
    expect(data.anagrams).toContain("silent");
    expect(data.anagrams).toContain("enlist");
  });

  it("does not include the input word itself", async () => {
    const res = await GET(makeFindRequest("listen"));
    const data = await res.json();
    expect(data.anagrams).not.toContain("listen");
  });

  it("finds anagrams of evil", async () => {
    const res = await GET(makeFindRequest("evil"));
    const data = await res.json();
    expect(data.anagrams).toContain("vile");
    expect(data.anagrams).toContain("live");
  });

  it("returns empty array for word with no anagrams", async () => {
    const res = await GET(makeFindRequest("zzzzz"));
    const data = await res.json();
    expect(data.anagrams).toEqual([]);
  });

  it("returns 400 when word is missing", async () => {
    const res = await GET(makeFindRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when word exceeds 30 chars", async () => {
    const res = await GET(makeFindRequest("a".repeat(31)));
    expect(res.status).toBe(400);
  });
});
