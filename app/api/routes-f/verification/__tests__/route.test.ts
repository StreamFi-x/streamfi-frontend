jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET as getVerification, POST } from "../route";
import { GET as getAdmin } from "../admin/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const authedSession = {
  ok: true as const,
  userId: "user-123",
  wallet: null,
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

const makeRequest = (method: string, path: string, body?: object) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("routes-f verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(authedSession);
    delete process.env.ROUTES_F_ADMIN_EMAILS;
  });

  it("returns unverified when no request exists", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await getVerification(
      makeRequest("GET", "/api/routes-f/verification")
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "unverified",
      request: null,
    });
  });

  it("blocks resubmission while pending", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ status: "pending" }] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/verification", {
        social_links: [],
        reason: "I have built an audience and want profile verification.",
      })
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringMatching(/pending/i),
    });
  });

  it("requires admin allowlist email for admin route", async () => {
    process.env.ROUTES_F_ADMIN_EMAILS = "admin@example.com";
    const res = await getAdmin(
      makeRequest("GET", "/api/routes-f/verification/admin")
    );
    expect(res.status).toBe(403);
  });

  it("returns pending requests for allowed admins", async () => {
    process.env.ROUTES_F_ADMIN_EMAILS = "admin@example.com";
    verifySessionMock.mockResolvedValue({
      ...authedSession,
      email: "admin@example.com",
    });

    sqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "req-1",
            status: "pending",
            social_links: [{ socialTitle: "x", socialLink: "https://x.com/a" }],
            reason: "Please verify my profile for creator credibility.",
            id_document_url: null,
            created_at: "2026-03-27T10:00:00.000Z",
            updated_at: "2026-03-27T10:00:00.000Z",
            creator_id: "user-123",
            username: "creator",
            avatar: "/Images/user.png",
            email: "creator@example.com",
          },
        ],
      });

    const res = await getAdmin(
      makeRequest("GET", "/api/routes-f/verification/admin")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].creator.username).toBe("creator");
  });
});
