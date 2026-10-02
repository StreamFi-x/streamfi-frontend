import { sql } from "@vercel/postgres";
import { GET } from "../route";
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
}));

const sqlMock = sql as unknown as jest.Mock;

function makeGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/tip-recap");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url) as any;
}

describe("Tip Recap Card API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/routes-f/tip-recap", () => {
    it("returns 400 for missing tip_id", async () => {
      const res = await GET(makeGetRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid tip_id", async () => {
      const res = await GET(makeGetRequest({ tip_id: "not-a-uuid" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown tip", async () => {
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const res = await GET(makeGetRequest({ tip_id: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Tip not found");
    });

    it("returns tip recap payload for a known tip", async () => {
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            tip_id: "tip-1",
            creator_id: "creator-1",
            tipper_id: "tipper-1",
            amount: "10.5",
            asset: "XLM",
            message: "Great stream!",
            is_anonymous: false,
            created_at: "2025-06-01T12:00:00Z",
            creator_username: "alice",
            creator_avatar: "alice.png",
            tipper_username: "bob",
            tipper_avatar: "bob.png",
          },
        ],
      });

      const res = await GET(makeGetRequest({ tip_id: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tip_id).toBe("tip-1");
      expect(body.creator.username).toBe("alice");
      expect(body.tipper.username).toBe("bob");
      expect(body.tipper.anonymous).toBe(false);
      expect(body.amount).toBe("10.5");
      expect(body.asset).toBe("XLM");
      expect(body.message).toBe("Great stream!");
      expect(body.image_meta).toEqual({ width: 1200, height: 630, format: "png" });
    });

    it("handles anonymous tips by hiding tipper details", async () => {
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            tip_id: "tip-2",
            creator_id: "creator-1",
            tipper_id: "tipper-2",
            amount: "5.0",
            asset: "USDC",
            message: null,
            is_anonymous: true,
            created_at: "2025-06-01T12:00:00Z",
            creator_username: "alice",
            creator_avatar: "alice.png",
            tipper_username: "anon",
            tipper_avatar: "anon.png",
          },
        ],
      });

      const res = await GET(makeGetRequest({ tip_id: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tipper.anonymous).toBe(true);
      expect(body.tipper.user_id).toBeNull();
      expect(body.tipper.username).toBeNull();
      expect(body.tipper.avatar).toBeNull();
      expect(body.message).toBeNull();
    });

    it("returns 500 on database error", async () => {
      sqlMock.mockRejectedValueOnce(new Error("DB error"));

      const res = await GET(makeGetRequest({ tip_id: "550e8400-e29b-41d4-a716-446655440000" }));
      expect(res.status).toBe(500);
    });
  });
});
