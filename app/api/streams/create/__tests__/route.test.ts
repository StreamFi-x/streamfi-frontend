/**
 * streams/create route tests (#1610).
 * POST must provision (or return the existing) stream for the session's own
 * wallet, never an arbitrary body-supplied wallet, since an unauthenticated
 * caller could otherwise trigger real Mux stream creation cost on a
 * victim's behalf, or read back their existing stream key.
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
  createMuxStream: jest.fn(),
}));

jest.mock("@/utils/validators", () => ({
  checkExistingTableDetail: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

jest.mock("@/lib/db/jsonb-contracts", () => ({
  JsonbContractError: class JsonbContractError extends Error {},
  isMergeableCreator: jest.fn(() => true),
  prepareCreatorPatch: jest.fn((patch: unknown) => patch),
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
import { checkExistingTableDetail } from "@/utils/validators";
import { verifySession } from "@/lib/auth/verify-session";
import { shouldBypassAuth } from "@/lib/dev-mode";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const checkExistingMock = checkExistingTableDetail as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const shouldBypassAuthMock = shouldBypassAuth as jest.Mock;

const OWNER_WALLET = "GOWNER0000000000000000000000000000000000000000000000000";
const VICTIM_WALLET = "GVICTIM000000000000000000000000000000000000000000000000";

const makeRequest = (body: object) =>
  new Request("http://localhost/api/streams/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

describe("POST /api/streams/create", () => {
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

  it("returns 401 when there is no valid session", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest({
      wallet: VICTIM_WALLET,
      title: "Attacker stream",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(checkExistingMock).not.toHaveBeenCalled();
  });

  it("ignores a body-supplied wallet and provisions for the session's own wallet", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: OWNER_WALLET,
      privyId: null,
      username: "owner",
      email: null,
    });
    checkExistingMock.mockResolvedValue(true);
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "u1",
          username: "owner",
          creator: {},
          mux_stream_id: "existing_mux_id",
          enable_recording: false,
          latency_mode: "low",
        },
      ],
    });

    // Attacker-supplied body wallet targets a victim who already has a
    // stream; if trusted, this call would read back the victim's own
    // stream key.
    const req = makeRequest({
      wallet: VICTIM_WALLET,
      title: "Attacker stream",
    });
    await POST(req);

    const flatArgs = sqlMock.mock.calls.flat();
    expect(flatArgs).toContain(OWNER_WALLET);
    expect(flatArgs).not.toContain(VICTIM_WALLET);
  });
});
