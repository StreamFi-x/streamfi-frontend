import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { clearAllAboutPages } from "../store";
import { MAX_ABOUT_BYTES } from "../types";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/channel/about");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel/about", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("channel/about", () => {
  beforeEach(() => {
    clearAllAboutPages();
  });

  describe("GET", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns empty about for unknown creator", async () => {
      const res = await GET(makeGetReq({ creator_id: "creator_new" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.about_markdown).toBe("");
      expect(data.last_updated).toBeNull();
    });

    it("returns saved about content", async () => {
      await PUT(
        makePutReq({
          creator_id: "creator_1",
          about_markdown: "# Welcome\n\nI stream on StreamFi.",
        })
      );

      const res = await GET(makeGetReq({ creator_id: "creator_1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.about_markdown).toContain("Welcome");
      expect(typeof data.last_updated).toBe("string");
    });
  });

  describe("PUT", () => {
    it("updates about content", async () => {
      const res = await PUT(
        makePutReq({
          creator_id: "creator_1",
          about_markdown: "Tips accepted in **XLM** and **USDC**.",
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.about_markdown).toContain("USDC");
      expect(typeof data.last_updated).toBe("string");
    });

    it("rejects content over 50KB", async () => {
      const oversized = "x".repeat(MAX_ABOUT_BYTES + 1);
      const res = await PUT(
        makePutReq({
          creator_id: "creator_1",
          about_markdown: oversized,
        })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("50");
    });

    it("accepts content at exactly 50KB", async () => {
      const exact = "x".repeat(MAX_ABOUT_BYTES);
      const res = await PUT(
        makePutReq({
          creator_id: "creator_1",
          about_markdown: exact,
        })
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 when creator_id is missing", async () => {
      const res = await PUT(makePutReq({ about_markdown: "hello" }));
      expect(res.status).toBe(400);
    });
  });
});
