jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";
import { PATCH } from "../route";

const verifySessionMock = verifySession as jest.Mock;
const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (body?: object) =>
  new Request("http://localhost/api/routes-f/profile-update-social-links", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("PATCH /api/routes-f/profile-update-social-links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when session is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await PATCH(makeRequest({ socialLinks: ["https://twitter.com/user"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when socialLinks is not an array", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const res = await PATCH(makeRequest({ socialLinks: "not-an-array" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/must be an array/i);
  });

  it("returns 400 when array contains more than 6 links", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const links = Array.from({ length: 7 }, (_, i) => `https://example${i}.com`);
    const res = await PATCH(makeRequest({ socialLinks: links }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Maximum of 6/i);
  });

  it("returns 400 when an invalid URL format is provided", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const res = await PATCH(makeRequest({ socialLinks: ["invalid-url-format"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid URL format/i);
  });

  it("returns 200 and updates valid social links successfully", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    sqlMock.mockResolvedValueOnce({ rows: [] });

    const links = [
      "https://github.com/user",
      { platform: "twitter", url: "https://twitter.com/user" },
    ];

    const res = await PATCH(makeRequest({ socialLinks: links }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.socialLinks).toHaveLength(2);
    expect(body.socialLinks[0].url).toBe("https://github.com/user");
  });
});
