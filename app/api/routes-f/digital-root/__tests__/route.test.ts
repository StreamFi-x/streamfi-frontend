jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET } from "../route";

function makeRequest(path: string) {
  return new Request(
    `http://localhost${path}`
  ) as unknown as import("next/server").NextRequest;
}

describe("routes-f digital-root", () => {
  it("returns zero for 0", async () => {
    const res = await GET(makeRequest("/api/routes-f/digital-root?n=0"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ digital_root: 0, persistence: 0 });
  });

  it("returns zero persistence for a single-digit number", async () => {
    const res = await GET(makeRequest("/api/routes-f/digital-root?n=7"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ digital_root: 7, persistence: 0 });
  });

  it("computes digital root and additive persistence for multi-step input", async () => {
    const res = await GET(makeRequest("/api/routes-f/digital-root?n=12345"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ digital_root: 6, persistence: 2 });
  });

  it("rejects invalid input", async () => {
    const res = await GET(makeRequest("/api/routes-f/digital-root?n=-9"));
    expect(res.status).toBe(400);
  });
});
