import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { resetStore } from "../_lib/languages";

function makeRequest(method: string, body?: unknown, query?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/routes-f/language");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  const init: RequestInit & { headers?: Record<string, string> } = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url.toString(), init);
}

describe("Language preference", () => {
  beforeEach(() => resetStore());

  describe("GET", () => {
    it("returns empty strings for unknown creator", async () => {
      const res = await GET(makeRequest("GET", undefined, { creator_id: "unknown" }));
      const body = await res.json();
      expect(body).toEqual({ primary: "", secondary: [] });
    });

    it("returns stored preferences", async () => {
      await PUT(makeRequest("PUT", { creator_id: "c1", primary: "en", secondary: ["es", "fr"] }));
      const res = await GET(makeRequest("GET", undefined, { creator_id: "c1" }));
      const body = await res.json();
      expect(body).toEqual({ primary: "en", secondary: ["es", "fr"] });
    });
  });

  describe("PUT", () => {
    it("stores valid language codes", async () => {
      const res = await PUT(makeRequest("PUT", { creator_id: "c1", primary: "en", secondary: ["es", "fr", "de"] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ primary: "en", secondary: ["es", "fr", "de"] });
    });

    it("rejects unsupported primary code", async () => {
      const res = await PUT(makeRequest("PUT", { creator_id: "c1", primary: "xyz", secondary: [] }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("xyz");
    });

    it("rejects unsupported secondary code", async () => {
      const res = await PUT(makeRequest("PUT", { creator_id: "c1", primary: "en", secondary: ["xyz"] }));
      expect(res.status).toBe(400);
    });

    it("rejects more than 4 secondary codes", async () => {
      const res = await PUT(
        makeRequest("PUT", {
          creator_id: "c1",
          primary: "en",
          secondary: ["es", "fr", "de", "it", "ja"],
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects duplicate secondary codes", async () => {
      const res = await PUT(
        makeRequest("PUT", {
          creator_id: "c1",
          primary: "en",
          secondary: ["es", "es"],
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Duplicate");
    });

    it("overwrites previous preferences", async () => {
      await PUT(makeRequest("PUT", { creator_id: "c1", primary: "en", secondary: ["es"] }));
      await PUT(makeRequest("PUT", { creator_id: "c1", primary: "fr", secondary: ["de", "it"] }));
      const res = await GET(makeRequest("GET", undefined, { creator_id: "c1" }));
      const body = await res.json();
      expect(body).toEqual({ primary: "fr", secondary: ["de", "it"] });
    });
  });
});
