/** @jest-environment node */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({ verifySession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));
jest.mock("@/lib/geolocation/ip-to-country", () => ({
  ipToCountry: jest.fn().mockResolvedValue({ country: "US" }),
}));
jest.mock("@/lib/stream/viewer-tracking", () => ({
  mutateViewerTracking: jest.fn(),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { mutateViewerTracking } from "@/lib/stream/viewer-tracking";
import { createViewerSession } from "@/lib/stream/viewer-session-token";
import { GET, POST, PATCH, DELETE } from "../route";

const tracking = jest.mocked(mutateViewerTracking);
const snapshot = {
  currentViewers: 2,
  previousViewers: 50,
  abandonedClosed: 0,
  inserted: true,
  username: "creator",
};
const request = (method: string, body: object, headers = {}) =>
  new NextRequest("http://localhost/api/streams/viewers", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.SESSION_SECRET = "test-viewer-session-secret-0123456789";
  tracking.mockResolvedValue(snapshot);
  (sql as unknown as jest.Mock).mockResolvedValue({
    rows: [{ id: "creator" }],
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.SESSION_SECRET;
});

it("mints a unique, uncached session for a live stream", async () => {
  const req = new NextRequest(
    "http://localhost/api/streams/viewers?playbackId=playback-1"
  );
  const a = await GET(req),
    b = await GET(req);
  expect(a.status).toBe(200);
  expect(a.headers.get("Cache-Control")).toBe("private, no-store");
  expect((await a.json()).sessionId).not.toBe((await b.json()).sessionId);
});
it("rejects minting without a playback ID or for an offline stream", async () => {
  expect(
    (await GET(new NextRequest("http://localhost/api/streams/viewers"))).status
  ).toBe(400);
  (sql as unknown as jest.Mock).mockResolvedValueOnce({ rows: [] });
  expect(
    (
      await GET(
        new NextRequest("http://localhost/api/streams/viewers?playbackId=p")
      )
    ).status
  ).toBe(404);
});
it.each([
  [POST, "POST"],
  [PATCH, "PATCH"],
  [DELETE, "DELETE"],
] as const)("requires a signed viewer token on %s", async (handler, method) => {
  expect(
    (await handler(request(method, { playbackId: "p", sessionId: "attacker" })))
      .status
  ).toBe(401);
  expect(tracking).not.toHaveBeenCalled();
});
it("rejects cross-stream and changed-session replays", async () => {
  const session = createViewerSession("other");
  expect(
    (await POST(request("POST", { ...session, playbackId: "p" }))).status
  ).toBe(401);
  expect(
    (await PATCH(request("PATCH", { ...session, sessionId: "changed" }))).status
  ).toBe(401);
  expect(tracking).not.toHaveBeenCalled();
});
it("joins using token-bound identity and server country; ignores caller user ID", async () => {
  const session = createViewerSession("p");
  const res = await POST(
    request(
      "POST",
      { ...session, playbackId: "p", userId: "forged" },
      { "cf-ipcountry": "GB", "x-real-ip": "203.0.113.1" }
    )
  );
  expect(res.status).toBe(201);
  expect((await res.json()).currentViewers).toBe(2);
  expect(tracking).toHaveBeenCalledWith({
    playbackId: "p",
    sessionId: session.sessionId,
    action: "join",
    viewerUserId: null,
    ip: "203.0.113.1",
    country: "GB",
  });
});
it("returns 200 for an idempotent join and 409 when no live session exists", async () => {
  const session = createViewerSession("p");
  tracking.mockResolvedValueOnce({ ...snapshot, inserted: false });
  expect(
    (await POST(request("POST", { ...session, playbackId: "p" }))).status
  ).toBe(200);
  tracking.mockResolvedValueOnce(null);
  expect(
    (await POST(request("POST", { ...session, playbackId: "p" }))).status
  ).toBe(409);
});

it("attributes authenticated viewers only to the server-verified identity", async () => {
  jest.mocked(verifySession).mockResolvedValueOnce({
    ok: true,
    userId: "verified-viewer",
    privyId: null,
    wallet: "Gwallet",
    username: "viewer",
    email: null,
  });
  const session = createViewerSession("p");
  expect(
    (
      await POST(
        request(
          "POST",
          { ...session, playbackId: "p", userId: "forged" },
          { cookie: "wallet_session=signed" }
        )
      )
    ).status
  ).toBe(201);
  expect(tracking).toHaveBeenCalledWith(
    expect.objectContaining({ viewerUserId: "verified-viewer" })
  );
});
it.each([
  [PATCH, "PATCH", "heartbeat"],
  [DELETE, "DELETE", "leave"],
] as const)(
  "routes %s through atomic tracking",
  async (handler, method, action) => {
    const session = createViewerSession("p");
    expect((await handler(request(method, session))).status).toBe(200);
    expect(tracking).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        playbackId: "p",
        sessionId: session.sessionId,
      })
    );
  }
);
it.each([
  [POST, "POST"],
  [PATCH, "PATCH"],
  [DELETE, "DELETE"],
] as const)(
  "returns a retryable failure rather than inventing counts on %s",
  async (handler, method) => {
    tracking.mockRejectedValueOnce(new Error("database unavailable"));
    const session = createViewerSession("p");
    const response = await handler(
      request(method, { ...session, playbackId: "p" })
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.json()).not.toHaveProperty("currentViewers");
  }
);
it("returns 400 for malformed JSON", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/streams/viewers", {
      method: "POST",
      body: "{",
    })
  );
  expect(response.status).toBe(400);
  expect(tracking).not.toHaveBeenCalled();
});
