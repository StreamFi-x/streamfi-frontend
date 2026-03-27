/**
 * Tests for POST /api/routes-f/conflicts/resolve
 */

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

jest.mock("../_lib/disputes", () => ({
  ensureDisputesTable: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { POST } from "../resolve/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const ADMIN_SESSION = {
  ok: true as const,
  userId: "admin-id",
  wallet: null,
  privyId: "did:privy:admin",
  username: "admin",
  email: "admin@streamfi.xyz",
};

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/conflicts/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/routes-f/conflicts/resolve", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(ADMIN_SESSION);
    // Default admin check: is admin
    sqlMock.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
  });

  afterEach(() => consoleSpy.mockRestore());

  it("returns 401 when not authenticated", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const res = await POST(
      makeRequest({ claimed_username: "alice", claimant_user_id: VALID_UUID, reason: "r", action: "deny" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not admin", async () => {
    // Override: not an admin
    sqlMock.mockReset();
    sqlMock.mockResolvedValueOnce({ rows: [] }); // no admin row
    const res = await POST(
      makeRequest({ claimed_username: "alice", claimant_user_id: VALID_UUID, reason: "r", action: "deny" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ claimed_username: "alice" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for invalid action", async () => {
    const res = await POST(
      makeRequest({ claimed_username: "alice", claimant_user_id: VALID_UUID, reason: "r", action: "steal" })
    );
    expect(res.status).toBe(400);
  });

  it("records denied dispute and returns action: deny", async () => {
    // admin check ✓ (already mocked in beforeEach)
    // claimant exists
    sqlMock.mockResolvedValueOnce({ rows: [{ id: VALID_UUID, username: "claimant" }] });
    // INSERT dispute
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest({
        claimed_username: "alice",
        claimant_user_id: VALID_UUID,
        reason: "Not a valid claim",
        action: "deny",
      })
    );
    const json = await res.json();
    expect(json.action).toBe("deny");
    expect(json.username).toBe("alice");
  });

  it("transfers username and renames holder atomically", async () => {
    // claimant exists
    sqlMock.mockResolvedValueOnce({ rows: [{ id: VALID_UUID, username: "claimant" }] });
    // holder exists
    sqlMock.mockResolvedValueOnce({ rows: [{ id: "holder-id", username: "alice" }] });
    // BEGIN, UPDATE holder, UPDATE claimant, INSERT dispute, COMMIT
    sqlMock.mockResolvedValue({ rows: [] });

    const res = await POST(
      makeRequest({
        claimed_username: "alice",
        claimant_user_id: VALID_UUID,
        reason: "Original creator",
        action: "transfer",
      })
    );
    const json = await res.json();
    expect(json.action).toBe("transfer");
    expect(json.username).toBe("alice");
    expect(json.previous_holder_renamed_to).toBe("alice_");
  });

  it("returns 404 when claimant user does not exist", async () => {
    // claimant not found
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest({
        claimed_username: "alice",
        claimant_user_id: VALID_UUID,
        reason: "claim",
        action: "transfer",
      })
    );
    expect(res.status).toBe(404);
  });
});
