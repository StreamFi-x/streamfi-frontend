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
import { POST } from "../route";

const verifySessionMock = verifySession as jest.Mock;
const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (body?: object) =>
  new Request("http://localhost/api/routes-f/subscription-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("POST /api/routes-f/subscription-cancel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when session is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await POST(makeRequest({ subscriptionId: "sub_123" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when subscriptionId is missing", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/subscriptionId is required/i);
  });

  it("returns 403 when user does not own the subscription", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "sub_123",
          user_id: "usr_other",
          subscriber_wallet: "GBBB...",
          status: "active",
        },
      ],
    });

    const res = await POST(makeRequest({ subscriptionId: "sub_123" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 and unsigned Soroban invocation on success", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: "sub_123",
          user_id: "usr_1",
          subscriber_wallet: "GAAA...",
          status: "active",
          contract_id: "CC3V_TEST",
        },
      ],
    });

    const res = await POST(makeRequest({ subscriptionId: "sub_123" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.subscriptionId).toBe("sub_123");
    expect(body.unsignedInvocation.contractId).toBe("CC3V_TEST");
    expect(body.unsignedInvocation.method).toBe("cancel_subscription");
  });
});
