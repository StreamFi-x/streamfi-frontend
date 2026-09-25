/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";
import { __resetGoogleLinkStore, getGoogleLinkForUser } from "./_lib/store";

// ---------------------------------------------------------------------------
// Mock @/lib/auth/verify-session
// ---------------------------------------------------------------------------
const mockVerifySession = jest.fn();

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCredential(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url"
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  // Signature isn't cryptographically verified by this route (documented
  // limitation), so any base64url string in the third segment is fine here.
  return `${header}.${payload}.fake-signature`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    sub: "google-user-123",
    aud: "test-client-id",
    email: "person@example.com",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/oauth-google-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockAuthed(userId: string) {
  mockVerifySession.mockResolvedValue({
    ok: true,
    userId,
    wallet: null,
    privyId: null,
    username: null,
    email: null,
  });
}

function mockUnauthed() {
  mockVerifySession.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/routes-f/oauth-google-link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetGoogleLinkStore();
  });

  it("links a Google identity to the authenticated account", async () => {
    mockAuthed("user-1");

    const req = makeReq({ credential: makeCredential(validClaims()) });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.linked).toBe(true);
    expect(data.google_id).toBe("google-user-123");
    expect(data.email).toBe("person@example.com");
    expect(typeof data.linked_at).toBe("string");

    const stored = getGoogleLinkForUser("user-1");
    expect(stored?.google_id).toBe("google-user-123");
  });

  it("rejects when unauthenticated", async () => {
    mockUnauthed();

    const req = makeReq({ credential: makeCredential(validClaims()) });
    const res = await POST(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("rejects a malformed credential", async () => {
    mockAuthed("user-1");

    const req = makeReq({ credential: "not-a-jwt" });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Invalid Google credential format");
  });

  it("rejects a missing credential", async () => {
    mockAuthed("user-1");

    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("credential is required");
  });

  it("rejects an expired credential", async () => {
    mockAuthed("user-1");

    const expired = makeCredential(
      validClaims({ exp: Math.floor(Date.now() / 1000) - 60 })
    );
    const req = makeReq({ credential: expired });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Credential has expired");
  });

  it("rejects a credential from a non-Google issuer", async () => {
    mockAuthed("user-1");

    const req = makeReq({
      credential: makeCredential(validClaims({ iss: "https://evil.example.com" })),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Credential was not issued by Google");
  });

  it("rejects invalid JSON bodies", async () => {
    mockAuthed("user-1");

    const req = new NextRequest("http://localhost/api/routes-f/oauth-google-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("is idempotent when re-linking the same Google identity to the same account", async () => {
    mockAuthed("user-1");

    const credential = makeCredential(validClaims());
    const first = await POST(makeReq({ credential }));
    expect(first.status).toBe(200);

    const second = await POST(makeReq({ credential }));
    expect(second.status).toBe(200);

    const data = await second.json();
    expect(data.linked).toBe(true);
    expect(data.google_id).toBe("google-user-123");
  });

  it("refuses to link a Google identity already linked to a different account", async () => {
    mockAuthed("user-1");
    const credential = makeCredential(validClaims());
    const first = await POST(makeReq({ credential }));
    expect(first.status).toBe(200);

    mockAuthed("user-2");
    const second = await POST(makeReq({ credential }));
    expect(second.status).toBe(409);

    const data = await second.json();
    expect(data.error).toBe(
      "This Google account is already linked to a different account."
    );

    // user-1's link must be untouched
    const stillLinked = getGoogleLinkForUser("user-1");
    expect(stillLinked?.google_id).toBe("google-user-123");
  });
});
