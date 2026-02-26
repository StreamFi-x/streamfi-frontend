jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      }),
  },
}));

import { GET } from "../meta/route";

const makeRequest = (method: string, path: string) =>
  new Request(`http://localhost${path}`, { method });

describe("GET /api/routes-f/meta", () => {
  it("returns 200 with routes metadata", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.routes).toBeDefined();
    expect(Array.isArray(body.routes)).toBe(true);
  });

  it("includes all routes-f handlers", async () => {
    const res = await GET();
    const body = await res.json();
    const paths = body.routes.map((r: any) => r.path);

    expect(paths).toContain("/api/routes-f/health");
    expect(paths).toContain("/api/routes-f/audit");
    expect(paths).toContain("/api/routes-f/search");
    expect(paths).toContain("/api/routes-f/validate");
    expect(paths).toContain("/api/routes-f/import");
    expect(paths).toContain("/api/routes-f/export");
    expect(paths).toContain("/api/routes-f/preferences");
    expect(paths).toContain("/api/routes-f/webhook");
    expect(paths).toContain("/api/routes-f/flags");
    expect(paths).toContain("/api/routes-f/metrics");
    expect(paths).toContain("/api/routes-f/maintenance");
    expect(paths).toContain("/api/routes-f/items/:id");
    expect(paths).toContain("/api/routes-f/jobs/:id");
    expect(paths).toContain("/api/routes-f/meta");
    expect(paths).toContain("/api/routes-f/items/:id");
    expect(paths).toContain("/api/routes-f/jobs/:id");
    expect(paths).toContain("/api/routes-f/meta");
  });

  it("includes methods for each route", async () => {
    const res = await GET();
    const body = await res.json();

    body.routes.forEach((route: any) => {
      expect(route.methods).toBeDefined();
      expect(Array.isArray(route.methods)).toBe(true);
      expect(route.methods.length).toBeGreaterThan(0);
    });
  });

  it("includes description for each route", async () => {
    const res = await GET();
    const body = await res.json();

    body.routes.forEach((route: any) => {
      expect(route.description).toBeDefined();
      expect(typeof route.description).toBe("string");
      expect(route.description.length).toBeGreaterThan(0);
    });
  });

  it("includes schema references where applicable", async () => {
    const res = await GET();
    const body = await res.json();

    const validateRoute = body.routes.find((r: any) => r.path === "/api/routes-f/validate");
    expect(validateRoute.requestSchema).toBeDefined();
    expect(validateRoute.responseSchema).toBeDefined();
  });

  it("marks deprecated routes when present", async () => {
    const res = await GET();
    const body = await res.json();

    body.routes.forEach((route: any) => {
      if (route.deprecated !== undefined) {
        expect(typeof route.deprecated).toBe("boolean");
      }
    });
  });

  it("returns valid JSON structure", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body).toHaveProperty("routes");
    body.routes.forEach((route: any) => {
      expect(route).toHaveProperty("path");
      expect(route).toHaveProperty("methods");
      expect(route).toHaveProperty("description");
    });
  });
});
