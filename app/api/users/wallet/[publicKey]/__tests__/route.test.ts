/**
 * users/wallet/[publicKey] route tests (#1612).
 * password_hash / encrypted_stellar_key / stream_password_hash must never
 * be returned to anyone (already enforced upstream). streamkey, privy_id,
 * and email must additionally be stripped unless the caller's session
 * wallet matches the requested wallet — this route had no such ownership
 * check at all before this fix, despite a comment claiming otherwise.
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

jest.mock("@/lib/cache", () => ({
  cacheHeaders: jest.fn(() => ({ "Cache-Control": "private, no-store" })),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const WALLET = "GWALLET00000000000000000000000000000000000000000000000000";

const makeRequest = () =>
  new Request(`http://localhost/api/users/wallet/${WALLET}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;

const dbRow = () => ({
  id: "u1",
  username: "someone",
  wallet: WALLET,
  streamkey: "sk_secret",
  privy_id: "did:privy:abc",
  email: "someone@example.com",
  password_hash: "should-never-appear",
  encrypted_stellar_key: "should-never-appear",
  stream_password_hash: "should-never-appear",
});

let consoleErrorSpy: jest.SpyInstance;

describe("GET /api/users/wallet/[publicKey]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("always strips server-only credential columns, even for the owner", async () => {
    sqlMock.mockResolvedValue({ rows: [dbRow()] });
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: WALLET,
      privyId: null,
      username: "someone",
      email: null,
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ publicKey: WALLET }),
    });
    const body = await res.json();

    expect(body.user.password_hash).toBeUndefined();
    expect(body.user.encrypted_stellar_key).toBeUndefined();
    expect(body.user.stream_password_hash).toBeUndefined();
  });

  it("returns streamkey, privy_id, and email when the caller's session wallet matches", async () => {
    sqlMock.mockResolvedValue({ rows: [dbRow()] });
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: WALLET,
      privyId: null,
      username: "someone",
      email: null,
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ publicKey: WALLET }),
    });
    const body = await res.json();

    expect(body.user.streamkey).toBe("sk_secret");
    expect(body.user.privy_id).toBe("did:privy:abc");
    expect(body.user.email).toBe("someone@example.com");
  });

  it("strips streamkey, privy_id, and email for an unauthenticated caller", async () => {
    sqlMock.mockResolvedValue({ rows: [dbRow()] });
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ publicKey: WALLET }),
    });
    const body = await res.json();

    expect(res.status).toBe(200); // still a public-safe response, not an error
    expect(body.user.streamkey).toBeUndefined();
    expect(body.user.privy_id).toBeUndefined();
    expect(body.user.email).toBeUndefined();
    expect(body.user.username).toBe("someone"); // public fields still returned
  });

  it("strips streamkey, privy_id, and email when a different logged-in user requests this wallet", async () => {
    sqlMock.mockResolvedValue({ rows: [dbRow()] });
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u2",
      wallet: "GOTHER0000000000000000000000000000000000000000000000000",
      privyId: null,
      username: "other",
      email: null,
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ publicKey: WALLET }),
    });
    const body = await res.json();

    expect(body.user.streamkey).toBeUndefined();
    expect(body.user.privy_id).toBeUndefined();
    expect(body.user.email).toBeUndefined();
  });
});
