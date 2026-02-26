jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), { ...init, headers });
    },
  },
}));

import { POST } from "../status/validate/route";
import { setRoutesFRecords } from "@/lib/routes-f/store";

const makeRequest = (body: any) =>
  new Request("http://localhost/api/routes-f/status/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/routes-f/status/validate", () => {
  beforeEach(() => {
    setRoutesFRecords([
      { id: "r1", title: "A", description: "A", tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "draft", etag: '"e"' },
      { id: "r2", title: "B", description: "B", tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "published", etag: '"e"' },
    ]);
  });

  it("rejects invalid payload with 422", async () => {
    const res = await POST(new Request("http://localhost/api/routes-f/status/validate", { method: "POST", body: "not-json" }));
    expect(res.status).toBe(422);
  });

  it("allows valid transition", async () => {
    const res = await POST(makeRequest({ id: "r1", target: "published" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(true);
  });

  it("returns blocking reasons for disallowed transition", async () => {
    const res = await POST(makeRequest({ id: "r2", target: "draft" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(false);
    expect(Array.isArray(body.reasons)).toBe(true);
    expect(body.reasons.length).toBeGreaterThan(0);
  });
});
