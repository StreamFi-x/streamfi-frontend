jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers && typeof init.headers === "object"
            ? (init.headers as Record<string, string>)
            : {}),
        },
      }),
  },
}));

import {
  ROUTES_F_API_VERSION,
  wrapRoutesFJson,
  jsonResponse,
} from "../version";

describe("routes-f version", () => {
  describe("ROUTES_F_API_VERSION", () => {
    it("is a non-empty string", () => {
      expect(typeof ROUTES_F_API_VERSION).toBe("string");
      expect(ROUTES_F_API_VERSION.length).toBeGreaterThan(0);
    });

    it("is a single source constant", () => {
      expect(ROUTES_F_API_VERSION).toBe("1");
    });
  });

  describe("wrapRoutesFJson", () => {
    it("adds apiVersion to payload", () => {
      const data = { items: [], total: 0 };
      const wrapped = wrapRoutesFJson(data);
      expect(wrapped).toHaveProperty("apiVersion", ROUTES_F_API_VERSION);
      expect(wrapped.items).toEqual([]);
      expect(wrapped.total).toBe(0);
    });

    it("preserves all top-level keys (backward compatible)", () => {
      const data = { flags: { a: true }, userId: "u1" };
      const wrapped = wrapRoutesFJson(data);
      expect(wrapped.apiVersion).toBe(ROUTES_F_API_VERSION);
      expect(wrapped.flags).toEqual({ a: true });
      expect(wrapped.userId).toBe("u1");
    });

    it("always sets apiVersion to the constant (overwrites if present)", () => {
      const data = { apiVersion: "custom", x: 1 };
      const wrapped = wrapRoutesFJson(data);
      expect(wrapped.apiVersion).toBe(ROUTES_F_API_VERSION);
      expect(wrapped.x).toBe(1);
    });
  });

  describe("jsonResponse", () => {
    it("returns a Response with status 200", () => {
      const res = jsonResponse({ status: "ok" }, { status: 200 });
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(200);
    });

    it("response body includes apiVersion and original data", async () => {
      const res = jsonResponse({ items: [1, 2], total: 2 }, { status: 200 });
      const body = await res.json();
      expect(body.apiVersion).toBe(ROUTES_F_API_VERSION);
      expect(body.items).toEqual([1, 2]);
      expect(body.total).toBe(2);
    });
  });
});
