/**
 * streams/key route tests (#1610).
 * GET must derive the wallet from the verified session, never trust a
 * client-supplied query param, since it returns the RTMP stream key.
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

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/lib/dev-mode", () => ({
  getWalletOrDevDefault: jest.fn((w: string | null) => w || ""),
  shouldBypassAuth: jest.fn(() => false),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const shouldBypassAuthMock = shouldBypassAuth as jest.Mock;

const makeRequest = (search?: string) =>
  new Request(`http://localhost/api/streams/key${search ?? ""}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;

let consoleErrorSpy: jest.SpyInstance;

describe("GET /api/streams/key", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldBypassAuthMock.mockReturnValue(false);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 401 when there is no valid session", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest(
      "?wallet=GVICTIM000000000000000000000000000000000000000000000000"
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("ignores a query-string wallet and uses the session's own wallet instead", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: "GOWNER0000000000000000000000000000000000000000000000000",
      privyId: null,
      username: "owner",
      email: null,
    });
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "u1",
          username: "owner",
          streamkey: "sk_secret_owner",
          mux_stream_id: "mux1",
          mux_playback_id: "pb1",
          is_live: false,
          enable_recording: false,
        },
      ],
    });

    const req = makeRequest(
      "?wallet=GVICTIM000000000000000000000000000000000000000000000000"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.streamData.streamKey).toBe("sk_secret_owner");
    const [, ...values] = sqlMock.mock.calls[0];
    expect(values).toContain(
      "GOWNER0000000000000000000000000000000000000000000000000"
    );
    expect(values).not.toContain(
      "GVICTIM000000000000000000000000000000000000000000000000"
    );
  });

  it("returns 400 when the session has no wallet", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: null,
      privyId: "did:privy:abc",
      username: "owner",
      email: null,
    });

    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
