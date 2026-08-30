jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";
import { PATCH } from "../route";

const verifySessionMock = verifySession as jest.Mock;
const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (body?: object) =>
  new Request("http://localhost/api/routes-f/profile-update-handle", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

describe("PATCH /api/routes-f/profile-update-handle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when session is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await PATCH(makeRequest({ handle: "new_handle" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when handle is missing", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/handle is required/i);
  });

  it("returns 400 when handle format is invalid", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const res = await PATCH(makeRequest({ handle: "ab" })); // too short
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/3-30 characters/i);
  });

  it("returns 429 when handle was changed less than 30 days ago", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    sqlMock.mockResolvedValueOnce({
      rows: [{ last_handle_change_at: tenDaysAgo, username: "old_handle" }],
    });

    const res = await PATCH(makeRequest({ handle: "new_handle" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/once every 30 days/i);
  });

  it("returns 409 when new handle is already taken", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ last_handle_change_at: fortyDaysAgo, username: "old_handle" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "usr_2" }], // taken by another user
      });

    const res = await PATCH(makeRequest({ handle: "taken_handle" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already taken/i);
  });

  it("returns 200 and updates handle successfully", async () => {
    verifySessionMock.mockResolvedValueOnce({
      ok: true,
      userId: "usr_1",
      wallet: "GAAA...",
    });

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    sqlMock
      .mockResolvedValueOnce({
        rows: [{ last_handle_change_at: fortyDaysAgo, username: "old_handle" }],
      })
      .mockResolvedValueOnce({
        rows: [], // not taken
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await PATCH(makeRequest({ handle: "cool_handle_99" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.username).toBe("cool_handle_99");
  });
});
