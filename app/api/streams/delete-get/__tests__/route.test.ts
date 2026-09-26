/**
 * streams/delete-get route tests (#1610).
 * A destructive GET (deletes the Mux stream, wipes DB fields) must never
 * trust a bare query-param wallet: it must derive the target wallet from
 * the verified session, otherwise any unauthenticated caller (or a
 * cross-site GET, since this is CSRF-triggerable by nature) can force-
 * delete any user's stream.
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

jest.mock("@/lib/mux/server", () => ({
  deleteMuxStream: jest.fn(),
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
import { deleteMuxStream } from "@/lib/mux/server";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const deleteMuxStreamMock = deleteMuxStream as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const shouldBypassAuthMock = shouldBypassAuth as jest.Mock;

const VICTIM_WALLET = "GVICTIM000000000000000000000000000000000000000000000000";

const makeRequest = (search?: string) =>
  new Request(`http://localhost/api/streams/delete-get${search ?? ""}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

describe("GET /api/streams/delete-get", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldBypassAuthMock.mockReturnValue(false);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  it("returns 401 and does not touch the database when there is no valid session", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest(`?wallet=${VICTIM_WALLET}`);
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
    expect(deleteMuxStreamMock).not.toHaveBeenCalled();
  });

  it("only ever force-deletes the session's own stream, ignoring a query-param wallet", async () => {
    const ownerWallet =
      "GOWNER0000000000000000000000000000000000000000000000000";
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: ownerWallet,
      privyId: null,
      username: "owner",
      email: null,
    });
    sqlMock.mockResolvedValueOnce({
      rows: [
        { id: "u1", username: "owner", mux_stream_id: "mux1", is_live: false },
      ],
    });
    sqlMock.mockResolvedValue({ rows: [] });

    const req = makeRequest(`?wallet=${VICTIM_WALLET}`);
    await GET(req);

    const flatArgs = sqlMock.mock.calls.flat();
    expect(flatArgs).toContain(ownerWallet);
    expect(flatArgs).not.toContain(VICTIM_WALLET);
  });
});
