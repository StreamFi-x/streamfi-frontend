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

jest.mock("../../../utils/userValidators", () => ({
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
import { PUT } from "@/app/api/users/updates/privy/[privyId]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const shouldBypassAuthMock = shouldBypassAuth as jest.Mock;

const TARGET_PRIVY_ID = "did:privy:victim123";
const ATTACKER_PRIVY_ID = "did:privy:attacker456";

const makeRequest = (formFields: Record<string, string>) => {
  const req = new Request(`http://localhost/api/users/updates/privy/${TARGET_PRIVY_ID}`, {
    method: "PUT",
  }) as any;
  req.formData = async () => ({
    get: (key: string) => formFields[key] ?? null,
  });
  return req;
};

describe("PUT /api/users/updates/privy/[privyId] authentication (#1857)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldBypassAuthMock.mockReturnValue(false);
  });

  it("rejects unauthenticated requests with 401 before reading target user", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest({ username: "hacked" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: TARGET_PRIVY_ID }),
    });

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects requests when session identity does not match target privyId with 403", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      privyId: ATTACKER_PRIVY_ID,
      userId: "attacker-user-id",
    });

    const req = makeRequest({ username: "hacked" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: TARGET_PRIVY_ID }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("allows updates when session identity matches target privyId", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      privyId: TARGET_PRIVY_ID,
      userId: "victim-user-id",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "victim-user-id",
          username: "target_user",
          email: "target@example.com",
          bio: "Original bio",
          streamkey: "sk_123",
          avatar: null,
          banner: null,
          sociallinks: null,
          emailverified: true,
          emailnotifications: true,
          creator: null,
          enable_recording: false,
          privy_id: TARGET_PRIVY_ID,
        },
      ],
    });

    sqlMock.mockResolvedValueOnce({
      rows: [{ id: "victim-user-id", username: "target_user", bio: "Updated bio" }],
    });

    const req = makeRequest({ bio: "Updated bio" });
    const res = await PUT(req, {
      params: Promise.resolve({ privyId: TARGET_PRIVY_ID }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
  });
});
