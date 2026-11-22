import { NextRequest } from "next/server";
import { POST } from "../route";
import { sql } from "@vercel/postgres";

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/dev-mode", () => ({
  shouldBypassAuth: () => true,
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn().mockResolvedValue({ ok: true, userId: "user-123" }),
}));

jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn().mockResolvedValue(undefined),
}));

describe("POST /api/routes-f/auth-email-change-rollback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("successfully rolls back pending email change to previous verified email", async () => {
    (sql as unknown as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-123",
            email: "alice@example.com",
            emailverified: true,
            pending_email: "newalice@example.com",
            pending_email_requested_at: new Date(),
            email_change_status: "pending",
            previous_verified_email: "alice@example.com",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest("http://localhost/api/routes-f/auth-email-change-rollback", {
      method: "POST",
      body: JSON.stringify({ userId: "user-123", action: "rollback" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("Email change rolled back successfully");
    expect(data.email).toBe("alice@example.com");
    expect(data.emailVerified).toBe(true);
  });

  test("rejects rollback when there is no pending or failed change", async () => {
    (sql as unknown as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "alice@example.com",
          emailverified: true,
          pending_email: null,
          email_change_status: "none",
          previous_verified_email: null,
        },
      ],
    });

    const req = new NextRequest("http://localhost/api/routes-f/auth-email-change-rollback", {
      method: "POST",
      body: JSON.stringify({ userId: "user-123", action: "rollback" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot rollback");
  });

  test("records bounce and marks change as failed", async () => {
    (sql as unknown as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-123",
            email: "alice@example.com",
            emailverified: true,
            pending_email: "bad@example.com",
            pending_email_requested_at: new Date(),
            email_change_status: "pending",
            previous_verified_email: "alice@example.com",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest("http://localhost/api/routes-f/auth-email-change-rollback", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-123",
        action: "bounce",
        reason: "550 User not found",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("failed");
    expect(data.failureReason).toBe("550 User not found");
  });
});
