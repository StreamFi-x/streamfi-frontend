/**
 * Routes-F maintenance endpoint tests.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET, POST } from "../maintenance/route";
import { clearMaintenanceWindows } from "@/lib/routes-f/store";
import { __test__resetRateLimit } from "@/lib/routes-f/rate-limit";

const makePost = (body: object) =>
  new Request("http://localhost/api/routes-f/maintenance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const makeGet = () =>
  new Request("http://localhost/api/routes-f/maintenance");

describe("/api/routes-f/maintenance", () => {
  beforeEach(() => {
    clearMaintenanceWindows();
    __test__resetRateLimit();
  });

  it("creates a maintenance window", async () => {
    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const res = await POST(makePost({ start, end }));
    expect(res.status).toBe(201);
  });

  it("rejects overlapping windows", async () => {
    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await POST(makePost({ start, end }));

    const overlapStart = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const overlapEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const res = await POST(makePost({ start: overlapStart, end: overlapEnd }));
    expect(res.status).toBe(409);
  });

  it("returns active windows", async () => {
    const start = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await POST(makePost({ start, end }));

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.windows.length).toBe(1);
  });
});
