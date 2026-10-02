import { NextRequest } from "next/server";
import { caesarDecode, bruteForceCaesar } from "./caesar";
import { englishLikenessScore } from "./score";
import { POST } from "./route";

// #889 feat(routesF): caesar cipher brute force

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/caesar-cipher", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/caesar-cipher", () => {
  describe("caesarDecode", () => {
    it("decodes a known ciphertext with the correct shift", () => {
      expect(caesarDecode("khoor", 3)).toBe("hello");
    });

    it("preserves case and non-alphabetic characters", () => {
      expect(caesarDecode("Khoor, Zruog!", 3)).toBe("Hello, World!");
    });
  });

  describe("bruteForceCaesar", () => {
    it("returns exactly 25 candidates with shifts 1 through 25", () => {
      const candidates = bruteForceCaesar("abc");

      expect(candidates).toHaveLength(25);
      expect(candidates.map((c) => c.shift)).toEqual(
        Array.from({ length: 25 }, (_, i) => i + 1)
      );
    });

    it("includes the correct plaintext among decodings", () => {
      const candidates = bruteForceCaesar("khoor");
      const match = candidates.find((c) => c.text === "hello");

      expect(match).toBeDefined();
      expect(match?.shift).toBe(3);
    });
  });

  describe("englishLikenessScore", () => {
    it("ranks plausible English above random letter strings", () => {
      const englishScore = englishLikenessScore(
        "the quick brown fox jumps over the lazy dog"
      );
      const randomScore = englishLikenessScore("xqzvkjwpmnbctyfg");

      expect(englishScore).toBeGreaterThan(randomScore);
    });
  });

  describe("POST", () => {
    it("returns all 25 candidates without scores by default", async () => {
      const res = await POST(makeReq({ text: "khoor" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.candidates).toHaveLength(25);
      expect(data.candidates.every((c: { score?: number }) => c.score === undefined)).toBe(
        true
      );
    });

    it("includes scores and ranks candidates when score is true", async () => {
      const res = await POST(
        makeReq({ text: "wklv lv d whvw", score: true })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.candidates).toHaveLength(25);
      expect(data.candidates.every((c: { score: number }) => typeof c.score === "number")).toBe(
        true
      );

      const scores = data.candidates.map((c: { score: number }) => c.score);
      for (let i = 1; i < scores.length; i += 1) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }

      expect(data.candidates[0].text.toLowerCase()).toContain("this");
    });

    it("rejects invalid bodies", async () => {
      const res = await POST(makeReq({ score: true }));
      expect(res.status).toBe(400);
    });
  });
});
