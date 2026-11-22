/**
 * users/updates/privy/[privyId] route tests (#1857).
 *
 * Verifies that PUT /api/users/updates/privy/[privyId] strictly enforces
 * authentication and ownership authorization (BOLA/IDOR defense), rejecting
 * unauthenticated requests (401), unauthorized account-takeover attempts (403),
 * validating and sanitizing input payloads, and allowing authorized owner updates (200).
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/utils/upload/cloudinary", () => ({
  uploadImageFromBuffer: jest.fn(),
  deleteImage: jest.fn(),
  extractPublicIdFromUrl: jest.fn(() => null),
}));

jest.mock("@/lib/db/jsonb-contracts", () => ({
  JsonbContractError: class JsonbContractError extends Error {},
}));

jest.mock("@/lib/users/profile-form", () => ({
  parseProfileJsonbFields: jest.fn(() => ({
    socialLinks: null,
    creator: null,
  })),
}));

jest.mock("@/utils/userValidators", () => ({
  validateUserUpdate: jest.fn(() => ({ isValid: true })),
}));

jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/lib/dev-mode", () => ({
  shouldBypassAuth: jest.fn(() => false),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import { PUT } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const shouldBypassAuthMock = shouldBypassAuth as jest.Mock;

const VICTIM_PRIVY_ID = "did:privy:victim123456789";
const ATTACKER_PRIVY_ID = "did:privy:attacker987654321";
const ADMIN_USER_ID = "user-admin-uuid-001";

const makeJsonRequest = (body: Record<string, unknown>) => {
  return new Request(
    `http://localhost/api/users/updates/privy/${VICTIM_PRIVY_ID}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  ) as unknown as import("next/server").NextRequest;
};

const makeMultipartRequest = (formFields: Record<string, string>) => {
  const boundary = "----testboundary";
  const parts = Object.entries(formFields).map(
    ([key, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
  );
  const body = parts.join("") + `--${boundary}--\r\n`;

  return new Request(
    `http://localhost/api/users/updates/privy/${VICTIM_PRIVY_ID}`,
    {
      method: "PUT",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    }
  ) as unknown as import("next/server").NextRequest;
};

let consoleErrorSpy: jest.SpyInstance;

describe("PUT /api/users/updates/privy/[privyId] - Auth & Authorization (#1857)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldBypassAuthMock.mockReturnValue(false);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 401 Unauthorized when no auth session is provided, before touching database", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const req = makeJsonRequest({ bio: "Malicious takeover bio" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 403 Forbidden when authenticated user tries to edit another user's profile (BOLA/IDOR attempt)", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "attacker-user-id",
      privyId: ATTACKER_PRIVY_ID,
      wallet: null,
      username: "attacker",
      email: "attacker@example.com",
    });

    // sqlMock returns non-admin role when checking caller's privileges
    sqlMock.mockResolvedValueOnce({ rows: [{ role: "user" }] });

    const req = makeJsonRequest({ bio: "Hacked bio by attacker" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("returns 403 Forbidden via multipart form data when caller does not own target profile", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "attacker-user-id",
      privyId: ATTACKER_PRIVY_ID,
      wallet: null,
      username: "attacker",
      email: "attacker@example.com",
    });

    sqlMock.mockResolvedValueOnce({ rows: [{ role: null }] });

    const req = makeMultipartRequest({
      bio: "Hacked via multipart",
      username: "pwned",
    });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("allows admin or moderator to update another user's profile", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: ADMIN_USER_ID,
      privyId: "did:privy:admin999",
      wallet: null,
      username: "admin_user",
      email: "admin@example.com",
    });

    // 1. Role query returns moderator
    sqlMock.mockResolvedValueOnce({ rows: [{ role: "moderator" }] });
    // 2. Fetch target user
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          bio: "Old bio",
          streamkey: "sk_123",
          avatar: "https://example.com/old-avatar.png",
          banner: null,
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          enable_recording: false,
          privy_id: VICTIM_PRIVY_ID,
        },
      ],
    });
    // 3. Update query succeeds
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          streamkey: "sk_123",
          avatar: "https://example.com/old-avatar.png",
          banner: null,
          bio: "Moderator reset bio",
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          privy_id: VICTIM_PRIVY_ID,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const req = makeJsonRequest({ bio: "Moderator reset bio" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("User updated successfully");
    expect(data.user.bio).toBe("Moderator reset bio");
  });

  it("returns 404 when target user is not found in database", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-id-123",
      privyId: VICTIM_PRIVY_ID,
      wallet: null,
      username: "victim",
      email: "victim@example.com",
    });

    // Fetch target user returns no rows
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const req = makeJsonRequest({ bio: "My new bio" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("User not found");
  });

  it("returns 200 when authenticated user edits their own profile successfully", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "victim-id",
      privyId: VICTIM_PRIVY_ID,
      wallet: null,
      username: "victim",
      email: "victim@example.com",
    });

    // 1. Fetch current user record
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          bio: "Original bio",
          streamkey: "sk_victim",
          avatar: "https://example.com/avatar.png",
          banner: "https://example.com/banner.png",
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          enable_recording: false,
          privy_id: VICTIM_PRIVY_ID,
        },
      ],
    });

    // 2. Update user record
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          streamkey: "sk_victim",
          avatar: "https://example.com/new-avatar.png",
          banner: "https://example.com/banner.png",
          bio: "Updated sanitized bio",
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          privy_id: VICTIM_PRIVY_ID,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const req = makeJsonRequest({
      bio: "  Updated sanitized bio  \u0000",
      avatarUrl: "https://example.com/new-avatar.png",
    });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("User updated successfully");
    expect(data.user.bio).toBe("Updated sanitized bio");
  });

  it("rejects bio longer than 500 characters with 400 Bad Request", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "victim-id",
      privyId: VICTIM_PRIVY_ID,
      wallet: null,
      username: "victim",
      email: "victim@example.com",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          bio: "Short bio",
          streamkey: "sk_victim",
          avatar: null,
          banner: null,
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          enable_recording: false,
          privy_id: VICTIM_PRIVY_ID,
        },
      ],
    });

    const excessivelyLongBio = "A".repeat(501);
    const req = makeJsonRequest({ bio: excessivelyLongBio });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("bio must be 500 characters or fewer");
  });

  it("rejects invalid avatar URL formats (e.g. javascript: URI) with 400 Bad Request", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "victim-id",
      privyId: VICTIM_PRIVY_ID,
      wallet: null,
      username: "victim",
      email: "victim@example.com",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          bio: "bio",
          streamkey: "sk_victim",
          avatar: null,
          banner: null,
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          enable_recording: false,
          privy_id: VICTIM_PRIVY_ID,
        },
      ],
    });

    const req = makeJsonRequest({ avatarUrl: "javascript:alert(1)" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid avatar URL format");
  });

  it("rejects duplicate username taken by another user with 400 Bad Request", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "victim-id",
      privyId: VICTIM_PRIVY_ID,
      wallet: null,
      username: "victim",
      email: "victim@example.com",
    });

    // Current user row
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-id",
          username: "victim",
          email: "victim@example.com",
          bio: "bio",
          streamkey: "sk_victim",
          avatar: null,
          banner: null,
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          enable_recording: false,
          privy_id: VICTIM_PRIVY_ID,
        },
      ],
    });

    // Username uniqueness check query finds existing user
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: "other-user-id" }],
    });

    const req = makeJsonRequest({ username: "already_taken_name" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: VICTIM_PRIVY_ID }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Username already in use");
  });
});
