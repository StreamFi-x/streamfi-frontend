import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/word-frequency", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/word-frequency", () => {
  it("returns correct counts for simple text", async () => {
    const res = await POST(makeReq({ text: "the cat sat on the mat the cat" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_words).toBe(8);
    expect(body.unique_words).toBeGreaterThan(0);
    expect(Array.isArray(body.top)).toBe(true);
  });

  it("top word is the most frequent", async () => {
    const res = await POST(makeReq({ text: "apple apple apple banana banana cherry" }));
    const body = await res.json();
    expect(body.top[0].word).toBe("apple");
    expect(body.top[0].count).toBe(3);
  });

  it("excludes stopwords when flag is set", async () => {
    const res = await POST(makeReq({ text: "the the the cat sat", exclude_stopwords: true }));
    const body = await res.json();
    const words = body.top.map((e: { word: string }) => e.word);
    expect(words).not.toContain("the");
  });

  it("includes stopwords by default", async () => {
    const res = await POST(makeReq({ text: "the the the cat sat" }));
    const body = await res.json();
    expect(body.top[0].word).toBe("the");
  });

  it("respects top_n param", async () => {
    const text = "a b c d e f g h i j k l m n o p q r s t u v w x y z";
    const res = await POST(makeReq({ text, top_n: 5 }));
    const body = await res.json();
    expect(body.top.length).toBeLessThanOrEqual(5);
  });

  it("caps top_n at 100", async () => {
    const res = await POST(makeReq({ text: "word ".repeat(200), top_n: 999 }));
    const body = await res.json();
    expect(body.top.length).toBeLessThanOrEqual(100);
  });

  it("rarity_score is between 0 and 1", async () => {
    const res = await POST(makeReq({ text: "time xyzunknownword" }));
    const body = await res.json();
    body.top.forEach((e: { rarity_score: number }) => {
      expect(e.rarity_score).toBeGreaterThanOrEqual(0);
      expect(e.rarity_score).toBeLessThanOrEqual(1);
    });
  });

  it("rare/unknown words score 1.0", async () => {
    const res = await POST(makeReq({ text: "xyzunknownword" }));
    const body = await res.json();
    expect(body.top[0].rarity_score).toBe(1.0);
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/word-frequency", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("each top entry has word, count, rarity_score", async () => {
    const res = await POST(makeReq({ text: "hello world hello" }));
    const body = await res.json();
    const entry = body.top[0];
    expect(entry).toHaveProperty("word");
    expect(entry).toHaveProperty("count");
    expect(entry).toHaveProperty("rarity_score");
  });
});
