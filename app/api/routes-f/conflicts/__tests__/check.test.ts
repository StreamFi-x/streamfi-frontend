/**
 * Tests for POST /api/routes-f/conflicts/check
 */

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

jest.mock("@/app/api/routes-f/conflicts/_lib/reserved", () => ({
  classifyRestriction: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { classifyRestriction } from "../_lib/reserved";
import { POST } from "../check/route";

const sqlMock = sql as unknown as jest.Mock;
const classifyMock = classifyRestriction as jest.Mock;

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/conflicts/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/routes-f/conflicts/check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for missing username", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for a username that is too short", async () => {
    const res = await POST(makeRequest({ username: "ab" }));
    expect(res.status).toBe(400);
  });

  it("returns available: true when username is free and unrestricted", async () => {
    classifyMock.mockResolvedValue(null);
    sqlMock.mockResolvedValue({ rows: [] });

    const res = await POST(makeRequest({ username: "alice99" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(true);
  });

  it("returns available: false with reason 'taken' when username exists in DB", async () => {
    classifyMock.mockResolvedValue(null);
    // First sql call: check availability in users table → taken
    // Subsequent calls: suggestion availability checks → all free
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: "user-1" }] }) // username exists
      .mockResolvedValue({ rows: [] }); // suggestions are free

    const res = await POST(makeRequest({ username: "alice" }));
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("taken");
    expect(Array.isArray(json.suggestions)).toBe(true);
  });

  it("returns available: false with reason 'reserved' for reserved words", async () => {
    classifyMock.mockResolvedValue("reserved");
    sqlMock.mockResolvedValue({ rows: [] }); // suggestions are free

    const res = await POST(makeRequest({ username: "admin" }));
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("reserved");
  });

  it("returns available: false with reason 'banned' for banned words", async () => {
    classifyMock.mockResolvedValue("banned");
    sqlMock.mockResolvedValue({ rows: [] }); // suggestions are free

    const res = await POST(makeRequest({ username: "badword" }));
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.reason).toBe("banned");
  });

  it("returns 500 on database error", async () => {
    classifyMock.mockRejectedValue(new Error("DB down"));

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest({ username: "alice99" }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
