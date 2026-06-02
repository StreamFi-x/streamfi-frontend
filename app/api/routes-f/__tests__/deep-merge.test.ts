// @ts-nocheck
/**
 * @jest-environment node
 */
import { POST, deepMerge } from "../deep-merge/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/deep-merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/deep-merge", () => {
  describe("deepMerge helper", () => {
    it("merges two flat objects", () => {
      const result = deepMerge([{ a: 1 }, { b: 2 }], "replace");
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("overwrites primitive values", () => {
      const result = deepMerge([{ a: 1 }, { a: 2 }], "replace");
      expect(result).toEqual({ a: 2 });
    });

    it("deep merges nested objects", () => {
      const result = deepMerge(
        [{ user: { name: "Alice", age: 30 } }, { user: { age: 31, city: "NYC" } }],
        "replace"
      );
      expect(result).toEqual({ user: { name: "Alice", age: 31, city: "NYC" } });
    });

    it("replace strategy replaces arrays", () => {
      const result = deepMerge([{ arr: [1, 2] }, { arr: [3, 4] }], "replace");
      expect(result).toEqual({ arr: [3, 4] });
    });

    it("concat strategy concatenates arrays", () => {
      const result = deepMerge([{ arr: [1, 2] }, { arr: [3, 4] }], "concat");
      expect(result).toEqual({ arr: [1, 2, 3, 4] });
    });

    it("union strategy deduplicates arrays", () => {
      const result = deepMerge([{ arr: [1, 2, 2] }, { arr: [2, 3] }], "union");
      expect(result).toEqual({ arr: [1, 2, 3] });
    });

    it("handles three objects", () => {
      const result = deepMerge([{ a: 1 }, { b: 2 }, { c: 3 }], "replace");
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("deeply nested merge", () => {
      const result = deepMerge(
        [
          { config: { db: { host: "localhost" } } },
          { config: { db: { port: 5432 }, cache: true } },
        ],
        "replace"
      );
      expect(result).toEqual({
        config: { db: { host: "localhost", port: 5432 }, cache: true },
      });
    });
  });

  describe("POST handler", () => {
    it("merges two objects with default strategy", async () => {
      const res = await POST(makeReq({ objects: [{ a: 1 }, { b: 2 }] }));
      expect(res.status).toBe(200);
      const { merged } = await res.json();
      expect(merged).toEqual({ a: 1, b: 2 });
    });

    it("uses replace strategy by default for arrays", async () => {
      const res = await POST(makeReq({ objects: [{ arr: [1] }, { arr: [2] }] }));
      const { merged } = await res.json();
      expect(merged.arr).toEqual([2]);
    });

    it("concat strategy works", async () => {
      const res = await POST(
        makeReq({ objects: [{ arr: [1] }, { arr: [2] }], array_strategy: "concat" })
      );
      const { merged } = await res.json();
      expect(merged.arr).toEqual([1, 2]);
    });

    it("union strategy works", async () => {
      const res = await POST(
        makeReq({ objects: [{ arr: [1, 2] }, { arr: [2, 3] }], array_strategy: "union" })
      );
      const { merged } = await res.json();
      expect(merged.arr).toEqual([1, 2, 3]);
    });

    it("deep nested merge via POST", async () => {
      const res = await POST(
        makeReq({
          objects: [
            { user: { name: "Bob", settings: { theme: "dark" } } },
            { user: { settings: { lang: "en" } } },
          ],
        })
      );
      const { merged } = await res.json();
      expect(merged.user.settings).toEqual({ theme: "dark", lang: "en" });
    });

    it("returns 400 for empty objects array", async () => {
      const res = await POST(makeReq({ objects: [] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing objects", async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid array_strategy", async () => {
      const res = await POST(
        makeReq({ objects: [{ a: 1 }], array_strategy: "invalid" })
      );
      expect(res.status).toBe(400);
    });

    it("handles single object", async () => {
      const res = await POST(makeReq({ objects: [{ a: 1, b: 2 }] }));
      const { merged } = await res.json();
      expect(merged).toEqual({ a: 1, b: 2 });
    });

    it("rejects body exceeding 2MB", async () => {
      const large = { objects: [{ data: "x".repeat(3 * 1024 * 1024) }] };
      const res = await POST(makeReq(large));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("exceeds");
    });
  });
});
