jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

let mockRateLimited = false;
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => mockRateLimited,
}));

import { sql } from "@vercel/postgres";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (
  body: object,
  headers?: Record<string, string>
): import("next/server").NextRequest =>
  new Request("http://localhost/api/routes-f/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

describe("POST /api/routes-f/reports", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimited = false;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("returns 429 when IP exceeds rate limit", async () => {
    mockRateLimited = true;

    const req = makeRequest({
      stream_id: "stream_123",
      streamer: "alice",
      reason: "spam",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/Too many reports/i);
  });

  it("returns 400 for invalid reason", async () => {
    const req = makeRequest({
      stream_id: "stream_123",
      streamer: "alice",
      reason: "abuse",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/reason must be one of/i);
  });

  it("stores report with hashed IP and returns 201 with confirmation ID", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // CREATE TABLE
      .mockResolvedValueOnce({ rows: [{ id: "report-abc" }], rowCount: 1 }); // INSERT

    const req = makeRequest(
      {
        stream_id: "stream_123",
        streamer: "alice",
        reason: "harassment",
        details: "Viewer repeatedly posting abuse in chat",
      },
      { "x-forwarded-for": "198.51.100.22" }
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.confirmationId).toBe("report-abc");

    expect(sqlMock).toHaveBeenCalledTimes(2);
    const insertArgs = sqlMock.mock.calls[1];
    const insertValues = insertArgs.slice(1);

    expect(insertValues).not.toContain("198.51.100.22");
    const ipHash = insertValues[4];
    expect(ipHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
