/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureRevenueEventsSchema: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const CHANNEL_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeGetRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/routes-f/analytics-daily-revenue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(overrides?: Partial<{ userId: string }>) {
  verifySessionMock.mockResolvedValue({
    ok: true,
    userId: overrides?.userId ?? CHANNEL_ID,
    wallet: null,
    privyId: "did:privy:abc",
    username: "creator",
    email: "creator@example.com",
  });
}

describe("routes-f analytics-daily-revenue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET", () => {
    it("returns 401 for unauthenticated requests", async () => {
      verifySessionMock.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      });

      const res = await GET(
        makeGetRequest(`/api/routes-f/analytics-daily-revenue?channel=${CHANNEL_ID}`)
      );

      expect(res.status).toBe(401);
    });

    it("returns 404 when the channel does not exist", async () => {
      mockSession();
      sqlMock.mockResolvedValueOnce({ rows: [] });

      const res = await GET(
        makeGetRequest(`/api/routes-f/analytics-daily-revenue?channel=${CHANNEL_ID}`)
      );

      expect(res.status).toBe(404);
    });

    it("returns 403 when requesting another channel's revenue", async () => {
      mockSession({ userId: "different-user-id" });
      sqlMock.mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] });

      const res = await GET(
        makeGetRequest(`/api/routes-f/analytics-daily-revenue?channel=${CHANNEL_ID}`)
      );

      expect(res.status).toBe(403);
    });

    it("returns daily tip and subscription revenue for the channel owner", async () => {
      mockSession();
      sqlMock
        .mockResolvedValueOnce({ rows: [{ id: CHANNEL_ID }] })
        .mockResolvedValueOnce({
          rows: [
            {
              bucket: "2026-08-24",
              tip_revenue: "12.5000000",
              subscription_revenue: "5.0000000",
              total_revenue: "17.5000000",
            },
          ],
        });

      const res = await GET(
        makeGetRequest(
          `/api/routes-f/analytics-daily-revenue?channel=${CHANNEL_ID}&days=7`
        )
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.daily_revenue).toHaveLength(1);
      expect(body.daily_revenue[0].total_revenue).toBe("17.5000000");
    });

    it("returns 500 when the database throws", async () => {
      mockSession();
      sqlMock.mockRejectedValueOnce(new Error("db down"));

      const res = await GET(
        makeGetRequest(`/api/routes-f/analytics-daily-revenue?channel=${CHANNEL_ID}`)
      );

      expect(res.status).toBe(500);
    });
  });

  describe("POST", () => {
    it("returns 401 for unauthenticated requests", async () => {
      verifySessionMock.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      });

      const res = await POST(
        makePostRequest({ channel: CHANNEL_ID, source: "tip", amount: 5 })
      );

      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid source", async () => {
      mockSession();

      const res = await POST(
        makePostRequest({ channel: CHANNEL_ID, source: "donation", amount: 5 })
      );

      expect(res.status).toBe(400);
    });

    it("returns 403 when recording revenue for another channel", async () => {
      mockSession({ userId: "different-user-id" });

      const res = await POST(
        makePostRequest({ channel: CHANNEL_ID, source: "tip", amount: 5 })
      );

      expect(res.status).toBe(403);
    });

    it("records a revenue event and returns 201", async () => {
      mockSession();
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "event-id",
            channel_id: CHANNEL_ID,
            source: "tip",
            amount: "5",
            occurred_at: "2026-08-25T00:00:00.000Z",
          },
        ],
      });

      const res = await POST(
        makePostRequest({ channel: CHANNEL_ID, source: "tip", amount: 5 })
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.source).toBe("tip");
    });
  });
});
