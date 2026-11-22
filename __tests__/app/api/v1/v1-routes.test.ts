/**
 * @jest-environment node
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

const mockSql = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

import {
  GET as getHealth,
  POST as postHealth,
} from "@/app/api/v1/health/route";
import {
  GET as getV1LiveStreams,
  POST as postV1LiveStreams,
} from "@/app/api/v1/streams/live/route";

describe("Versioned /api/v1/* endpoints (#1718)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockSql.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("GET /api/v1/health", () => {
    it("returns v1 canonical envelope with X-API-Version header and mainnet guard state", async () => {
      process.env.VERCEL_ENV = "preview";
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

      const res = await getHealth();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(res.headers.get("X-API-Version")).toBe("v1");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(body).toEqual({
        success: true,
        data: {
          status: "ok",
          apiVersion: "v1",
          supportedVersions: ["v1"],
          stellar: {
            network: "mainnet",
            deploymentContext: "preview",
            mainnetGuardActive: true,
            transactionsBlocked: true,
          },
        },
        meta: { apiVersion: "v1" },
      });
      expect(body.status).toBeUndefined();
    });

    it("returns 405 Method Not Allowed for POST with Allow: GET and X-API-Version", async () => {
      const res = await postHealth();
      const body = await res.json();

      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
      expect(res.headers.get("X-API-Version")).toBe("v1");
      expect(body).toEqual({
        success: false,
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
        meta: { apiVersion: "v1" },
      });
    });
  });

  describe("GET /api/v1/streams/live", () => {
    it("returns strict v1 envelope without legacy top-level duplication", async () => {
      mockSql.mockResolvedValueOnce({
        rows: [
          {
            id: "u-1",
            username: "streamer1",
            avatar: null,
            mux_playback_id: "pb-1",
            current_viewers: 42,
            total_views: 1000,
            stream_started_at: "2026-11-20T08:00:00.000Z",
            creator: {
              streamTitle: "Live Coding",
              description: "Building APIs",
              category: "Tech",
              tags: ["code"],
              thumbnail: null,
            },
          },
        ],
      });

      const res = await getV1LiveStreams(
        new Request("http://localhost/api/v1/streams/live?offset=0")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(res.headers.get("X-API-Version")).toBe("v1");
      expect(res.headers.get("Cache-Control")).toBeDefined();
      expect(body.success).toBe(true);
      expect(body.meta).toEqual({ apiVersion: "v1" });
      expect(body.data.streams).toHaveLength(1);
      expect(body.data.streams[0].username).toBe("streamer1");
      expect(body.data.hasMore).toBe(false);
      expect(body.data.nextOffset).toBeNull();
      expect(body.streams).toBeUndefined();
    });

    it("rejects invalid offset parameters with 400 BAD_REQUEST", async () => {
      const res = await getV1LiveStreams(
        new Request("http://localhost/api/v1/streams/live?offset=-5")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(res.headers.get("X-API-Version")).toBe("v1");
      expect(body).toEqual({
        success: false,
        error: "offset must be a non-negative integer",
        code: "BAD_REQUEST",
        meta: { apiVersion: "v1" },
      });
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("returns 500 INTERNAL_ERROR when database query fails", async () => {
      mockSql.mockRejectedValueOnce(new Error("connection lost"));

      const res = await getV1LiveStreams(
        new Request("http://localhost/api/v1/streams/live")
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(res.headers.get("X-API-Version")).toBe("v1");
      expect(body).toEqual({
        success: false,
        error: "Failed to fetch live streams",
        code: "INTERNAL_ERROR",
        meta: { apiVersion: "v1" },
      });
    });

    it("returns 405 Method Not Allowed for POST", async () => {
      const res = await postV1LiveStreams();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET");
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });
  });
});
