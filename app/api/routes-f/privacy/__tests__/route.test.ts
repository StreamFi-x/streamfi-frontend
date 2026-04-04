jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
    },
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("@/app/api/routes-f/_lib/schema", () => ({
  ensureRoutesFSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, PATCH } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as any;
}

describe("routes-f privacy settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(makeRequest("GET", "/api/routes-f/privacy"));
    expect(res.status).toBe(401);
  });

  it("returns default settings when none exist in DB", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
    });

    sqlMock.mockResolvedValueOnce({ rows: [] });

    const res = await GET(makeRequest("GET", "/api/routes-f/privacy"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.show_in_viewer_list).toBe(true);
    expect(json.searchable_by_email).toBe(false);
  });

  it("returns stored settings from DB", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          show_in_viewer_list: false,
          show_watch_history: true,
          show_following_list: false,
          allow_collab_requests: false,
          searchable_by_email: true,
        },
      ],
    });

    const res = await GET(makeRequest("GET", "/api/routes-f/privacy"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.show_in_viewer_list).toBe(false);
    expect(json.show_watch_history).toBe(true);
    expect(json.searchable_by_email).toBe(true);
  });

  it("updates settings via PATCH (upsert)", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
    });

    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          user_id: "user-123",
          show_in_viewer_list: false,
          show_watch_history: false,
          show_following_list: true,
          allow_collab_requests: true,
          searchable_by_email: true,
        },
      ],
    });

    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/privacy", {
        show_in_viewer_list: false,
        searchable_by_email: true,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.show_in_viewer_list).toBe(false);
    expect(json.searchable_by_email).toBe(true);
    expect(sqlMock).toHaveBeenCalled();
  });

  it("validates field types in PATCH", async () => {
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-123",
    });

    const res = await PATCH(
      makeRequest("PATCH", "/api/routes-f/privacy", {
        show_in_viewer_list: "yes", // should be boolean
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid type/);
  });
});
