import { sql } from "@vercel/postgres";
import { GET, POST, DELETE } from "../route";
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

const UUID1 = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";
const UUID3 = "550e8400-e29b-41d4-a716-446655440002";

function makeGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/viewer/reminders");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url) as any;
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/routes-f/viewer/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeDeleteRequest(body: object) {
  return new NextRequest("http://localhost/api/routes-f/viewer/reminders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("Scheduled Stream Reminder API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/routes-f/viewer/reminders", () => {
    it("returns 400 for missing viewer_id", async () => {
      const res = await GET(makeGetRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns upcoming reminders", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "r1",
            viewer_id: UUID1,
            scheduled_stream_id: UUID2,
            fires_at: "2025-06-02T18:00:00Z",
            created_at: "2025-06-01T12:00:00Z",
          },
        ],
      });

      const res = await GET(makeGetRequest({ viewer_id: UUID1 }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reminders).toHaveLength(1);
      expect(body.reminders[0].scheduled_stream_id).toBe(UUID2);
    });

    it("returns empty list when no reminders", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const res = await GET(makeGetRequest({ viewer_id: UUID1 }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reminders).toHaveLength(0);
    });

    it("returns 500 on database error", async () => {
      sqlMock.mockRejectedValueOnce(new Error("DB error"));

      const res = await GET(makeGetRequest({ viewer_id: UUID1 }));
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/routes-f/viewer/reminders", () => {
    it("sets a reminder for a scheduled stream", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({
        rows: [{ id: UUID2, scheduled_at: "2025-06-02T18:00:00Z" }],
      });
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "r1",
            viewer_id: UUID1,
            scheduled_stream_id: UUID2,
            fires_at: "2025-06-02T18:00:00Z",
            created_at: "2025-06-01T12:00:00Z",
          },
        ],
      });

      const res = await POST(makePostRequest({
        viewer_id: UUID1,
        scheduled_stream_id: UUID2,
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reminder_set).toBe(true);
      expect(body.fires_at).toBe("2025-06-02T18:00:00Z");
    });

    it("returns 404 for unknown scheduled stream", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const res = await POST(makePostRequest({
        viewer_id: UUID1,
        scheduled_stream_id: UUID3,
      }));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Scheduled stream not found");
    });

    it("returns 400 for missing fields", async () => {
      const res = await POST(makePostRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 500 on database error", async () => {
      sqlMock.mockRejectedValueOnce(new Error("DB error"));

      const res = await POST(makePostRequest({
        viewer_id: UUID1,
        scheduled_stream_id: UUID2,
      }));
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /api/routes-f/viewer/reminders", () => {
    it("removes a reminder", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({ rowCount: 1 });

      const res = await DELETE(makeDeleteRequest({
        viewer_id: UUID1,
        scheduled_stream_id: UUID2,
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.removed).toBe(true);
    });

    it("returns removed=false for non-existent reminder", async () => {
      sqlMock.mockResolvedValueOnce({});
      sqlMock.mockResolvedValueOnce({ rowCount: 0 });

      const res = await DELETE(makeDeleteRequest({
        viewer_id: UUID1,
        scheduled_stream_id: UUID3,
      }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.removed).toBe(false);
    });

    it("returns 400 for missing fields", async () => {
      const res = await DELETE(makeDeleteRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 500 on database error", async () => {
      sqlMock.mockRejectedValueOnce(new Error("DB error"));

      const res = await DELETE(makeDeleteRequest({
        viewer_id: UUID1,
        scheduled_stream_id: UUID2,
      }));
      expect(res.status).toBe(500);
    });
  });
});
