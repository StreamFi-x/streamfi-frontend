import { GET } from "../route";

// Polyfill NextResponse.json for jsdom test environment or if Next.js types aren't fully loaded
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      }),
  },
}));

describe("GET /api/routes-f/items/[id]", () => {
  it("returns 200 and the item for a valid and existing ID", async () => {
    const params = { id: "1" };
    const request = new Request("http://localhost/api/routes-f/items/1");

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: "1",
      name: "Standard Fast Route",
      description: "High-speed data transfer route optimized for low latency.",
      status: "active",
      capacity: "10Gbps",
    });

    // Check for ETag header
    expect(response.headers.get("ETag")).toBeTruthy();
    expect(response.headers.get("ETag")).toMatch(/^W\/"[a-zA-Z0-0=+/]{20}"/);
  });

  it("returns 400 for an invalid ID format (non-numeric)", async () => {
    const params = { id: "abc" };
    const request = new Request("http://localhost/api/routes-f/items/abc");

    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid ID format");
  });

  it("returns 404 for an ID that does not exist", async () => {
    const params = { id: "99" };
    const request = new Request("http://localhost/api/routes-f/items/99");

    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 404 for a missing ID", async () => {
    // In actual Next.js routing, this might not hit this route,
    // but the handler should be robust.
    const params = { id: "" };
    const request = new Request("http://localhost/api/routes-f/items/");

    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("missing");
  });
});
