/**
 * @jest-environment node
 */
jest.mock("@/lib/mux/server", () => ({ getMuxLiveStreamState: jest.fn() }));
jest.mock("@/lib/admin-auth", () => ({ verifyAdminSession: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => jest.fn().mockResolvedValue(false)),
}));
jest.mock("@/lib/jobs/scheduled-job", () => ({
  ...jest.requireActual("@/lib/jobs/scheduled-job"),
  runScheduledJob: jest.fn(),
}));
jest.mock("@/lib/stream/session-reconciliation", () => ({
  reconcileOrphanedSessions: jest.fn(),
}));

import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { runScheduledJob } from "@/lib/jobs/scheduled-job";
import { getMuxLiveStreamState } from "@/lib/mux/server";
import { reconcileOrphanedSessions } from "@/lib/stream/session-reconciliation";
import { GET, POST } from "../route";

const runJob = runScheduledJob as jest.Mock;
const adminSession = verifyAdminSession as jest.Mock;
const ORIGINAL_ENV = process.env;

function request(method: "GET" | "POST", headers: Record<string, string> = {}) {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-close-inactive-sessions",
    { method, headers }
  );
}

describe("/api/routes-f/cron-close-inactive-sessions", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: "test-cron-secret",
      INTERNAL_API_SECRET: "test-internal-secret",
    };
    adminSession.mockResolvedValue(false);
    runJob.mockResolvedValue({
      job: "stream-session-reconciliation",
      status: "succeeded",
      startedAt: "2026-09-25T00:00:00.000Z",
      durationMs: 12,
      metrics: { inspected: 2, closed: 1 },
      alerts: [],
      detail: [{ sessionId: "s1", userId: "u1", action: "closed" }],
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("GET rejects requests without the cron bearer token", async () => {
    const res = await GET(request("GET", { authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });

  it("GET fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request("GET", { authorization: "Bearer " }));
    expect(res.status).toBe(401);
  });

  it("GET runs the reconciliation job under a lease with Mux as ground truth", async () => {
    const res = await GET(
      request("GET", { authorization: "Bearer test-cron-secret" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        job: "stream-session-reconciliation",
        status: "succeeded",
        metrics: { inspected: 2, closed: 1 },
      })
    );
    const options = runJob.mock.calls[0][0];
    expect(options.name).toBe("stream-session-reconciliation");
    expect(options.leaseSeconds).toBeGreaterThan(60);

    await options.run();
    expect(reconcileOrphanedSessions).toHaveBeenCalledWith({
      getStreamState: getMuxLiveStreamState,
    });
  });

  it("reports partial runs as 207 and failed runs as 500", async () => {
    runJob.mockResolvedValueOnce({
      status: "partial",
      metrics: {},
      alerts: [],
    });
    const partial = await GET(
      request("GET", { authorization: "Bearer test-cron-secret" })
    );
    expect(partial.status).toBe(207);

    runJob.mockResolvedValueOnce({
      status: "failed",
      metrics: {},
      alerts: [],
      error: "db down",
    });
    const failed = await GET(
      request("GET", { authorization: "Bearer test-cron-secret" })
    );
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toBe("db down");
  });

  it("GET no longer leaks session counts to unauthenticated callers", async () => {
    const res = await GET(request("GET"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("POST accepts the internal secret", async () => {
    const res = await POST(
      request("POST", { "x-internal-secret": "test-internal-secret" })
    );
    expect(res.status).toBe(200);
  });

  it("POST accepts an admin session", async () => {
    adminSession.mockResolvedValue(true);
    const res = await POST(request("POST"));
    expect(res.status).toBe(200);
  });

  it("POST rejects anyone else", async () => {
    const res = await POST(request("POST", { "x-internal-secret": "nope" }));
    expect(res.status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });
});
