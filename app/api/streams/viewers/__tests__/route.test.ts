/**
 * streams/viewers PATCH (heartbeat) tests (#1403).
 * Touched periodically by the watch page while a viewer is still on the
 * page; the reconciliation job uses this to tell a still-watching viewer
 * apart from one whose leave call never fired.
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

import { sql } from "@vercel/postgres";
import { PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (body: object) =>
  new Request("http://localhost/api/streams/viewers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

let consoleErrorSpy: jest.SpyInstance;

describe("PATCH /api/streams/viewers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlMock.mockResolvedValue({ rows: [] });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 400 when sessionId is missing", async () => {
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("touches heartbeat_at for the given open session and returns 200", async () => {
    const res = await PATCH(makeRequest({ sessionId: "viewer-session-1" }));

    expect(res.status).toBe(200);
    const [queryText, ...values] = sqlMock.mock.calls[0];
    expect(queryText.join("")).toMatch(/heartbeat_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(queryText.join("")).toMatch(/left_at IS NULL/i);
    expect(values).toContain("viewer-session-1");
  });

  it("returns 200 even if the underlying query throws (missing table/column tolerance)", async () => {
    sqlMock.mockRejectedValue(new Error("relation does not exist"));

    const res = await PATCH(makeRequest({ sessionId: "viewer-session-1" }));

    expect(res.status).toBe(200);
  });
});
