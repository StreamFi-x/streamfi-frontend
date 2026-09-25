/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import { __resetTwitterLinkStore, __seedTwitterLink } from "../_lib/store";

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
function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/oauth-twitter-link", {
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
describe("POST /api/routes-f/oauth-twitter-link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetTwitterLinkStore();
  });

  it("links a Twitter identity to the authenticated account", async () => {
    mockAuthed("user-1");

    const req = makeReq({ oauth_code: "valid_twitter_code_1" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.linked).toBe(true);
    expect(data.twitter_id).toBe("tw_1001");
    expect(data.username).toBe("creator_one");
    expect(typeof data.linked_at).toBe("string");
  });

  it("rejects when unauthenticated", async () => {
    mockUnauthed();

    const req = makeReq({ oauth_code: "valid_twitter_code_1" });
    const res = await POST(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("rejects an invalid or expired authorization code", async () => {
    mockAuthed("user-1");

    const req = makeReq({ oauth_code: "not-a-real-code" });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Invalid or expired Twitter authorization code");
  });

  it("rejects a missing oauth_code", async () => {
    mockAuthed("user-1");

    const req = makeReq({});
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("oauth_code is required");
  });

  it("rejects invalid JSON bodies", async () => {
    mockAuthed("user-1");

    const req = new NextRequest("http://localhost/api/routes-f/oauth-twitter-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("is idempotent when re-linking the same Twitter identity to the same account", async () => {
    mockAuthed("user-1");

    const first = await POST(makeReq({ oauth_code: "valid_twitter_code_1" }));
    expect(first.status).toBe(200);

    const second = await POST(makeReq({ oauth_code: "valid_twitter_code_1" }));
    expect(second.status).toBe(200);

    const data = await second.json();
    expect(data.linked).toBe(true);
    expect(data.twitter_id).toBe("tw_1001");
  });

  it("refuses to link a Twitter identity already linked to a different account", async () => {
    __seedTwitterLink("user-existing-owner", "tw_1002");
    mockAuthed("user-2");

    const res = await POST(makeReq({ oauth_code: "valid_twitter_code_2" }));
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error).toBe(
      "Twitter account 'creator_two' is already linked to a different account"
    );
  });
});
