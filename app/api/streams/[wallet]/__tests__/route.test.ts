/**
 * streams/[wallet] route tests (#1610).
 * The route stays public (viewer pages read it unauthenticated), but the
 * RTMP streamKey must only ever be present in the response for the stream's
 * own owner, never for an anonymous visitor or a different logged-in user.
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
  getMuxStreamHealth: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const STREAMER_WALLET =
  "GSTREAMER00000000000000000000000000000000000000000000000";

const makeRequest = () =>
  new Request(`http://localhost/api/streams/${STREAMER_WALLET}`, {
    method: "GET",
  }) as unknown as import("next/server").NextRequest;

const dbRow = {
  id: "u1",
  username: "streamer",
  avatar: null,
  bio: null,
  mux_stream_id: "mux1",
  mux_playback_id: "pb1",
  streamkey: "sk_super_secret",
  is_live: true,
  current_viewers: 5,
  total_views: 100,
  stream_started_at: null,
  creator: {},
  socialLinks: null,
  created_at: null,
  follower_count: 0,
  session_id: null,
};

let consoleErrorSpy: jest.SpyInstance;

describe("GET /api/streams/[wallet]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlMock.mockResolvedValue({ rows: [dbRow] });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("does not leak the streamKey to an unauthenticated visitor", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ wallet: STREAMER_WALLET }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.streamData.stream.streamKey).toBeNull();
    expect(body.streamData.user.username).toBe("streamer");
    expect(body.streamData.stream.isLive).toBe(true);
  });

  it("does not leak the streamKey to a different logged-in user viewing someone else's stream", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u2",
      wallet: "GVIEWER0000000000000000000000000000000000000000000000000",
      privyId: null,
      username: "viewer",
      email: null,
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ wallet: STREAMER_WALLET }),
    });
    const body = await res.json();

    expect(body.streamData.stream.streamKey).toBeNull();
  });

  it("returns the streamKey when the caller's session wallet matches the stream owner", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "u1",
      wallet: STREAMER_WALLET,
      privyId: null,
      username: "streamer",
      email: null,
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ wallet: STREAMER_WALLET }),
    });
    const body = await res.json();

    expect(body.streamData.stream.streamKey).toBe("sk_super_secret");
  });
});
