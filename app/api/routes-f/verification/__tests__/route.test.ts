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
import { GET as getAdminVerification } from "../admin/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const authedSession = {
  ok: true as const,
  userId: "user-123",
  wallet: "G123",
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

function makeRequest(path: string, method: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

function mockEnsureTable() {
  sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
  sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

describe("/api/routes-f/verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VERIFICATION_ADMIN_USER_IDS;
    delete process.env.VERIFICATION_ADMIN_EMAILS;
    verifySessionMock.mockResolvedValue(authedSession);
  });

  it("returns unverified when no request exists", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await getVerification(
      makeRequest("/api/routes-f/verification", "GET")
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "unverified",
      request: null,
    });
  });

  it("creates a pending request for a new submission", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // initial SELECT
    sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "req-1",
          user_id: "user-123",
          status: "pending",
          social_links: [
            {
              socialTitle: "Twitter",
              socialLink: "https://twitter.com/creator",
            },
          ],
          reason: "Large audience and active community.",
          id_document_url: "https://example.com/id.png",
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: "2026-03-27T10:00:00.000Z",
          updated_at: "2026-03-27T10:00:00.000Z",
        },
      ],
    });

    const res = await POST(
      makeRequest("/api/routes-f/verification", "POST", {
        social_links: [
          { title: "Twitter", url: "https://twitter.com/creator" },
        ],
        reason: "Large audience and active community.",
        id_document_url: "https://example.com/id.png",
      })
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      status: "pending",
      request: {
        social_links: [
          {
            socialTitle: "Twitter",
            socialLink: "https://twitter.com/creator",
          },
        ],
        reason: "Large audience and active community.",
        id_document_url: "https://example.com/id.png",
        rejection_reason: null,
        reviewed_at: null,
        created_at: "2026-03-27T10:00:00.000Z",
        updated_at: "2026-03-27T10:00:00.000Z",
      },
    });
  });

  it("rejects resubmission while a request is pending", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "req-1",
          user_id: "user-123",
          status: "pending",
          social_links: [],
          reason: "Already pending",
          id_document_url: null,
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: "2026-03-27T10:00:00.000Z",
          updated_at: "2026-03-27T10:00:00.000Z",
        },
      ],
    });

    const res = await POST(
      makeRequest("/api/routes-f/verification", "POST", {
        social_links: [
          { socialTitle: "Twitter", socialLink: "https://twitter.com/creator" },
        ],
        reason: "Retrying while pending",
      })
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Cannot resubmit while verification is pending",
    });
  });

  it("allows rejected creators to resubmit", async () => {
    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "req-1",
          user_id: "user-123",
          status: "rejected",
          social_links: [],
          reason: "Old request",
          id_document_url: null,
          rejection_reason: "Need stronger proof",
          reviewed_by: "admin-1",
          reviewed_at: "2026-03-26T10:00:00.000Z",
          created_at: "2026-03-25T10:00:00.000Z",
          updated_at: "2026-03-26T10:00:00.000Z",
        },
      ],
    });
    sqlMock.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "req-1",
          user_id: "user-123",
          status: "pending",
          social_links: [
            {
              socialTitle: "YouTube",
              socialLink: "https://youtube.com/@creator",
            },
          ],
          reason: "Updated information",
          id_document_url: null,
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: "2026-03-25T10:00:00.000Z",
          updated_at: "2026-03-27T10:00:00.000Z",
        },
      ],
    });

    const res = await POST(
      makeRequest("/api/routes-f/verification", "POST", {
        social_links: [
          { platform: "YouTube", url: "https://youtube.com/@creator" },
        ],
        reason: "Updated information",
      })
    );

    expect(res.status).toBe(201);
    const updateCall = sqlMock.mock.calls[3];
    expect(updateCall[1]).toContain("YouTube");
  });

  it("requires admin session for the admin endpoint", async () => {
    process.env.VERIFICATION_ADMIN_EMAILS = "admin@example.com";
    verifySessionMock.mockResolvedValue({
      ...authedSession,
      email: "creator@example.com",
    });

    const res = await getAdminVerification(
      makeRequest("/api/routes-f/verification/admin", "GET")
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("lists pending verification requests for admins", async () => {
    process.env.VERIFICATION_ADMIN_EMAILS = "admin@example.com";
    verifySessionMock.mockResolvedValue({
      ...authedSession,
      email: "admin@example.com",
    });

    mockEnsureTable();
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "req-9",
          user_id: "user-999",
          status: "pending",
          social_links: [
            {
              socialTitle: "Twitter",
              socialLink: "https://twitter.com/pending",
            },
          ],
          reason: "Please verify my creator profile.",
          id_document_url: "https://example.com/id.pdf",
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: "2026-03-27T09:00:00.000Z",
          updated_at: "2026-03-27T09:00:00.000Z",
          username: "pending-creator",
          email: "pending@example.com",
          wallet: "G999",
          avatar: "/Images/user.png",
        },
      ],
    });

    const res = await getAdminVerification(
      makeRequest("/api/routes-f/verification/admin", "GET")
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requests: [
        {
          id: "req-9",
          user_id: "user-999",
          username: "pending-creator",
          email: "pending@example.com",
          wallet: "G999",
          avatar: "/Images/user.png",
          status: "pending",
          social_links: [
            {
              socialTitle: "Twitter",
              socialLink: "https://twitter.com/pending",
            },
          ],
          reason: "Please verify my creator profile.",
          id_document_url: "https://example.com/id.pdf",
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: "2026-03-27T09:00:00.000Z",
          updated_at: "2026-03-27T09:00:00.000Z",
        },
      ],
    });
  });
});
