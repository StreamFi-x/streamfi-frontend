/**
 * streams/viewers route tests.
 *
 * #1403: PATCH (heartbeat) lets the reconciliation job tell a still-watching
 * viewer apart from one whose leave call never fired.
 *
 * #725: POST/PATCH/DELETE must present a server-issued viewer-session token
 * (minted via GET) that binds the server-generated session id to a specific
 * stream, instead of trusting an arbitrary client-supplied `sessionId`.
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

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));

jest.mock("@/lib/geolocation/ip-to-country", () => ({
  ipToCountry: jest.fn().mockResolvedValue({ country: "US" }),
}));

import { sql } from "@vercel/postgres";
import { GET, POST, PATCH, DELETE } from "../route";
import { createViewerSession } from "@/lib/stream/viewer-session-token";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (
  body: object,
  method: "POST" | "PATCH" | "DELETE" = "PATCH"
) =>
  new Request("http://localhost/api/streams/viewers", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

const makeGetRequest = (playbackId?: string) =>
  new Request(
    `http://localhost/api/streams/viewers${
      playbackId ? `?playbackId=${encodeURIComponent(playbackId)}` : ""
    }`
  ) as unknown as import("next/server").NextRequest;

let consoleErrorSpy: jest.SpyInstance;

describe("/api/streams/viewers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SESSION_SECRET = "test-viewer-session-secret-0123456789";
    sqlMock.mockReset();
    sqlMock.mockResolvedValue({ rows: [] });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    delete process.env.SESSION_SECRET;
  });

  describe("GET (mint viewer session)", () => {
    it("returns 400 when playbackId is missing", async () => {
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the stream is not live", async () => {
      sqlMock.mockResolvedValueOnce({ rows: [] });
      const res = await GET(makeGetRequest("playback-1"));
      expect(res.status).toBe(404);
    });

    it("mints a session id and signed token for a live stream", async () => {
      sqlMock.mockResolvedValueOnce({ rows: [{ id: "user-1" }] });
      const res = await GET(makeGetRequest("playback-1"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.sessionId).toBe("string");
      expect(body.sessionId.length).toBeGreaterThan(0);
      expect(typeof body.token).toBe("string");
      expect(body.token).toContain(".");
    });
  });

  describe("POST (viewer join)", () => {
    it("returns 400 when playbackId or sessionId is missing", async () => {
      const res = await POST(makeRequest({}, "POST"));
      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("rejects an arbitrary, client-chosen session id with no token (#725)", async () => {
      const res = await POST(
        makeRequest(
          { playbackId: "playback-1", sessionId: "attacker-1" },
          "POST"
        )
      );
      expect(res.status).toBe(401);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("rejects a token minted for a different stream", async () => {
      const session = createViewerSession("playback-OTHER");
      const res = await POST(
        makeRequest(
          {
            playbackId: "playback-1",
            sessionId: session.sessionId,
            token: session.token,
          },
          "POST"
        )
      );
      expect(res.status).toBe(401);
    });

    it("rejects a token whose session id does not match the body", async () => {
      const session = createViewerSession("playback-1");
      const res = await POST(
        makeRequest(
          {
            playbackId: "playback-1",
            sessionId: "some-other-id",
            token: session.token,
          },
          "POST"
        )
      );
      expect(res.status).toBe(401);
    });

    it("counts a viewer when a valid token is presented", async () => {
      const session = createViewerSession("playback-1");
      sqlMock
        .mockResolvedValueOnce({
          rows: [
            {
              id: "user-1",
              username: "creator",
              is_live: true,
              session_id: "ss-1",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // dedup check
        .mockResolvedValueOnce({ rows: [{ current_viewers: 42 }] }) // update
        .mockResolvedValueOnce({ rows: [] }) // insert stream_viewers
        .mockResolvedValueOnce({ rows: [] }); // update stream_sessions

      const res = await POST(
        makeRequest(
          {
            playbackId: "playback-1",
            sessionId: session.sessionId,
            token: session.token,
          },
          "POST"
        )
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.currentViewers).toBe(42);

      // Verify stream_viewers insert includes country
      const insertCall = sqlMock.mock.calls.find(call =>
        call[0].join("").includes("INSERT INTO stream_viewers")
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[0].join("")).toContain("country");
      expect(insertCall).toContain("US");
    });

    it("populates country from CF-IPCountry header if present", async () => {
      const session = createViewerSession("playback-1");
      sqlMock
        .mockResolvedValueOnce({
          rows: [
            {
              id: "user-1",
              username: "creator",
              is_live: true,
              session_id: "ss-1",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ current_viewers: 10 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const req = new Request("http://localhost/api/streams/viewers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-ipcountry": "GB",
        },
        body: JSON.stringify({
          playbackId: "playback-1",
          sessionId: session.sessionId,
          token: session.token,
        }),
      }) as unknown as import("next/server").NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(201);

      const insertCall = sqlMock.mock.calls.find(call =>
        call[0].join("").includes("INSERT INTO stream_viewers")
      );
      expect(insertCall).toBeDefined();
      expect(insertCall).toContain("GB");
    });
  });

  describe("PATCH (heartbeat)", () => {
    it("returns 400 when sessionId is missing", async () => {
      const res = await PATCH(makeRequest({}));
      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("rejects a heartbeat without a token (#725)", async () => {
      const res = await PATCH(makeRequest({ sessionId: "viewer-session-1" }));
      expect(res.status).toBe(401);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("touches heartbeat_at for the token's session and returns 200", async () => {
      const session = createViewerSession("playback-1");
      const res = await PATCH(
        makeRequest({ sessionId: session.sessionId, token: session.token })
      );

      expect(res.status).toBe(200);
      const [queryText, ...values] = sqlMock.mock.calls[0];
      expect(queryText.join("")).toMatch(
        /heartbeat_at\s*=\s*CURRENT_TIMESTAMP/i
      );
      expect(queryText.join("")).toMatch(/left_at IS NULL/i);
      expect(values).toContain(session.sessionId);
    });

    it("returns 200 even if the underlying query throws (missing table/column tolerance)", async () => {
      const session = createViewerSession("playback-1");
      sqlMock.mockRejectedValue(new Error("relation does not exist"));

      const res = await PATCH(
        makeRequest({ sessionId: session.sessionId, token: session.token })
      );

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE (viewer leave)", () => {
    it("returns 400 when sessionId is missing", async () => {
      const res = await DELETE(makeRequest({}, "DELETE"));
      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("rejects leaving a session without a valid token (sabotage guard, #725)", async () => {
      const res = await DELETE(
        makeRequest(
          { sessionId: "victim-session", playbackId: "playback-1" },
          "DELETE"
        )
      );
      expect(res.status).toBe(401);
      expect(sqlMock).not.toHaveBeenCalled();
    });

    it("decrements the count when a valid token is presented", async () => {
      const session = createViewerSession("playback-1");
      sqlMock
        .mockResolvedValueOnce({ rows: [{ stream_session_id: "ss-1" }] })
        .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await DELETE(
        makeRequest(
          { sessionId: session.sessionId, token: session.token },
          "DELETE"
        )
      );

      expect(res.status).toBe(200);
    });
  });
});
