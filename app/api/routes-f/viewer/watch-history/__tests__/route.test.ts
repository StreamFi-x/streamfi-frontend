import { sql } from "@vercel/postgres";
import { GET, POST } from "../route";
import { NextRequest } from "next/server";

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

jest.mock("@/app/api/routes-f/_lib/validate", () => ({
  validateQuery: jest.fn((params: URLSearchParams, schema: any) => {
    const obj = Object.fromEntries(params.entries());
    const result = schema.safeParse(obj);
    if (!result.success) {
      return new Response(JSON.stringify({ error: "Invalid query", details: result.error.flatten() }), { status: 400 });
    }
    return { data: result.data };
  }),
  validateBody: jest.fn(async (req: Request, schema: any) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }
    const result = schema.safeParse(body);
    if (!result.success) {
      return new Response(JSON.stringify({ error: "Invalid request body", details: result.error.flatten() }), { status: 400 });
    }
    return { data: result.data };
  }),
}));

const sqlMock = sql as unknown as jest.Mock;

function makeGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/viewer/watch-history");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url) as any;
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/routes-f/viewer/watch-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("Viewer Watch History API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/routes-f/viewer/watch-history", () => {
    it("returns 400 for missing viewer_id", async () => {
      const res = await GET(makeGetRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid viewer_id", async () => {
      const res = await GET(makeGetRequest({ viewer_id: "not-a-uuid" }));
      expect(res.status).toBe(400);
    });

    it("returns watch history entries", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "h1",
            viewer_id: "v1",
            target_type: "stream",
            target_id: "t1",
            watched_at: "2025-06-01T12:00:00Z",
            created_at: "2025-06-01T12:00:00Z",
            updated_at: "2025-06-01T12:00:00Z",
          },
          {
            id: "h2",
            viewer_id: "v1",
            target_type: "vod",
            target_id: "t2",
            watched_at: "2025-06-01T10:00:00Z",
            created_at: "2025-06-01T10:00:00Z",
            updated_at: "2025-06-01T10:00:00Z",
          },
        ],
      });

      const res = await GET(makeGetRequest({ viewer_id: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toHaveLength(2);
      expect(body.entries[0].watched_at).toBe("2025-06-01T12:00:00Z");
    });

    it("respects limit parameter", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const res = await GET(makeGetRequest({ viewer_id: "550e8400-e29b-41d4-a716-446655440000", limit: "5" }));
      expect(res.status).toBe(200);
    });

    it("returns 500 on database error", async () => {
      sqlMock.mockRejectedValueOnce(new Error("DB error"));

      const res = await GET(makeGetRequest({ viewer_id: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/routes-f/viewer/watch-history", () => {
    it("returns 400 for missing fields", async () => {
      const res = await POST(makePostRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid target_type", async () => {
      const res = await POST(makePostRequest({
        viewer_id: "550e8400-e29b-41d4-a716-446655440000",
        target_type: "invalid",
        target_id: "550e8400-e29b-41d4-a716-446655440001",
      }));
      expect(res.status).toBe(400);
    });

    it("creates a new watch history entry", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "h1",
            viewer_id: "v1",
            target_type: "stream",
            target_id: "t1",
            watched_at: "2025-06-01T12:00:00Z",
            created_at: "2025-06-01T12:00:00Z",
            updated_at: "2025-06-01T12:00:00Z",
          },
        ],
      });

      const res = await POST(makePostRequest({
        viewer_id: "550e8400-e29b-41d4-a716-446655440000",
        target_type: "stream",
        target_id: "550e8400-e29b-41d4-a716-446655440001",
      }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.entry).toBeDefined();
      expect(body.entry.target_type).toBe("stream");
    });

    it("deduplicates by keeping latest timestamp", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "h1",
            viewer_id: "v1",
            target_type: "stream",
            target_id: "t1",
            watched_at: "2025-06-02T12:00:00Z",
            created_at: "2025-06-01T10:00:00Z",
            updated_at: "2025-06-02T12:00:00Z",
          },
        ],
      });

      const res = await POST(makePostRequest({
        viewer_id: "550e8400-e29b-41d4-a716-446655440000",
        target_type: "stream",
        target_id: "550e8400-e29b-41d4-a716-446655440001",
      }));
      expect(res.status).toBe(201);
      expect(sqlMock).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining("ON CONFLICT")])
      );
    });

    it("returns 500 on database error", async () => {
      sqlMock.mockRejectedValueOnce(new Error("DB error"));

      const res = await POST(makePostRequest({
        viewer_id: "550e8400-e29b-41d4-a716-446655440000",
        target_type: "stream",
        target_id: "550e8400-e29b-41d4-a716-446655440001",
      }));
      expect(res.status).toBe(500);
    });
  });
});
