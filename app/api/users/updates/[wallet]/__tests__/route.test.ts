/**
 * users/updates/[wallet] route tests (#1610 — discovered alongside the
 * issue's listed routes). This was the most severe of the routes found: an
 * unauthenticated PUT let any caller overwrite ANY user's username, email,
 * avatar, banner, bio, and streamkey by supplying that user's wallet in the
 * path, a full account-takeover primitive.
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

jest.mock("@/lib/mux/server", () => ({
  updateMuxStreamRecording: jest.fn(),
}));

jest.mock("@/utils/validators", () => ({
  validateEmail: jest.fn(() => true),
}));

jest.mock("../../../../../../utils/userValidators", () => ({
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

const VICTIM_WALLET = "GVICTIM000000000000000000000000000000000000000000000000";
const ATTACKER_WALLET =
  "GATTACKER0000000000000000000000000000000000000000000000";

// The jsdom test environment's fetch polyfill (whatwg-fetch) cannot parse a
// FormData instance handed directly as a Request body (it can't reconstruct
// multipart boundaries when reading it back via req.formData()), so the
// multipart body is built by hand with an explicit boundary instead.
const makeRequest = (formFields: Record<string, string>) => {
  const boundary = "----testboundary";
  const parts = Object.entries(formFields).map(
    ([key, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
  );
  const body = parts.join("") + `--${boundary}--\r\n`;

  return new Request(`http://localhost/api/users/updates/${VICTIM_WALLET}`, {
    method: "PUT",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  }) as unknown as import("next/server").NextRequest;
};

let consoleErrorSpy: jest.SpyInstance;

describe("PUT /api/users/updates/[wallet]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldBypassAuthMock.mockReturnValue(false);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 401 when there is no valid session, before ever reading the target user", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = makeRequest({ username: "hacked" });
    const res = await PUT(req, {
      params: Promise.resolve({ wallet: VICTIM_WALLET }),
    });

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated caller's wallet does not match the path wallet (account takeover attempt)", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "attacker-id",
      wallet: ATTACKER_WALLET,
      privyId: null,
      username: "attacker",
      email: null,
    });

    const req = makeRequest({
      username: "hacked",
      email: "attacker@evil.example",
    });
    const res = await PUT(req, {
      params: Promise.resolve({ wallet: VICTIM_WALLET }),
    });

    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("is case-insensitive when comparing the session wallet against the path wallet (does not 403 the legitimate owner)", async () => {
    // node-fetch v2 (this repo's jsdom Request polyfill; see jest.setup.ts)
    // has no formData() implementation at all, so the route's body-parsing
    // past the auth gate can't be exercised under this harness — this test
    // is scoped to proving the case-insensitive wallet comparison itself
    // lets the request through (never 403s), not the full update flow.
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: VICTIM_WALLET.toUpperCase(),
      privyId: null,
      username: "owner",
      email: null,
    });

    const req = makeRequest({ username: "owner-renamed" });
    const res = await PUT(req, {
      params: Promise.resolve({ wallet: VICTIM_WALLET.toLowerCase() }),
    });

    // The ownership check itself passed (never 403'd); the route then
    // fetches the current user row before parsing the request body, which
    // is exactly where this test's coverage ends given the formData()
    // limitation described above.
    expect(res.status).not.toBe(403);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});
