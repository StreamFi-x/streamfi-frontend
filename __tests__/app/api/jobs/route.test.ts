/**
 * @jest-environment node
 *
 * POST/GET /api/jobs/[job]: authentication (real QStash signature
 * verification, CRON_SECRET) and how deliveries are handed to the executor.
 */
import { createHash, createHmac, randomUUID } from "crypto";

const mockExecute = jest.fn();
jest.mock("@/lib/jobs/execute", () => ({
  executeJob: (...args: unknown[]) => mockExecute(...args),
}));
jest.mock("@/lib/jobs/registry", () => {
  const job = { name: "tip-total-reconciliation", maxAttempts: 3 };
  return {
    getJob: (name: string) => (name === job.name ? job : null),
  };
});

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/jobs/[job]/route";
import { resetQStashForTests } from "@/lib/jobs/qstash";

const BASE = "https://streamfi.test";
const CURRENT_KEY = "sentinel-current-signing-key";
const NEXT_KEY = "sentinel-next-signing-key";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Signs like QStash: HS256 JWT over the destination URL and body hash. */
function sign(
  url: string,
  body: string,
  key = CURRENT_KEY,
  claims: Record<string, unknown> = {}
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: "Upstash",
      sub: url,
      iat: now,
      nbf: now,
      exp: now + 300,
      jti: randomUUID(),
      body: base64url(createHash("sha256").update(body).digest()),
      ...claims,
    })
  );
  const signature = base64url(
    createHmac("sha256", key).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

const context = (job: string) => ({ params: Promise.resolve({ job }) });

function post(
  job: string,
  body: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`${BASE}/api/jobs/${job}`, {
    method: "POST",
    body,
    headers,
  });
}

beforeEach(() => {
  process.env.JOBS_BASE_URL = BASE;
  process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT_KEY;
  process.env.QSTASH_NEXT_SIGNING_KEY = NEXT_KEY;
  process.env.CRON_SECRET = "sentinel-cron-secret";
  resetQStashForTests();
  mockExecute.mockReset().mockResolvedValue({
    httpStatus: 200,
    status: "succeeded",
    attempt: 1,
    maxAttempts: 3,
    result: { durationMs: 5, metrics: { reconciled: 2 } },
  });
});

describe("/api/jobs/[job]", () => {
  const job = "tip-total-reconciliation";
  const url = `${BASE}/api/jobs/${job}`;

  it("rejects a request with neither a signature nor the cron secret", async () => {
    const res = await POST(post(job, "{}"), context(job));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("runs a correctly signed QStash delivery with its message id and retry count", async () => {
    const res = await POST(
      post(job, "{}", {
        "upstash-signature": sign(url, "{}"),
        "upstash-message-id": "msg_123",
        "upstash-retried": "2",
      }),
      context(job)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      job,
      status: "succeeded",
      attempt: 1,
      max_attempts: 3,
      duration_ms: 5,
      metrics: { reconciled: 2 },
    });
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ name: job }),
      {},
      { trigger: "qstash", messageId: "msg_123", retried: 2 }
    );
  });

  it("accepts a signature made with the next key (key rotation)", async () => {
    const res = await POST(
      post(job, "{}", { "upstash-signature": sign(url, "{}", NEXT_KEY) }),
      context(job)
    );
    expect(res.status).toBe(200);
  });

  it.each([
    ["a wrong key", () => sign(url, "{}", "sentinel-wrong-key")],
    ["another URL", () => sign(`${BASE}/api/jobs/other-job`, "{}")],
    ["another body", () => sign(url, '{"userId":"x"}')],
    [
      "an expired token",
      () => sign(url, "{}", CURRENT_KEY, { exp: 1, nbf: 0, iat: 0 }),
    ],
    ["another issuer", () => sign(url, "{}", CURRENT_KEY, { iss: "Evil" })],
  ])("rejects a signature for %s", async (_label, signature) => {
    const res = await POST(
      post(job, "{}", { "upstash-signature": signature() }),
      context(job)
    );
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("fails closed when the signing keys are not configured", async () => {
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    resetQStashForTests();
    const res = await POST(
      post(job, "{}", { "upstash-signature": sign(url, "{}") }),
      context(job)
    );
    expect(res.status).toBe(401);
  });

  it("does not reveal which jobs exist to an unauthenticated caller", async () => {
    const res = await POST(post("nope", "{}"), context("nope"));
    expect(res.status).toBe(401);
  });

  it("lets an operator run a job with the cron secret, with no retries", async () => {
    const res = await POST(
      post(job, "", { authorization: "Bearer sentinel-cron-secret" }),
      context(job)
    );
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith(expect.anything(), undefined, {
      trigger: "manual",
      messageId: null,
      retried: 0,
    });
  });

  it("supports GET with the cron secret (Vercel Cron)", async () => {
    const req = new NextRequest(`${BASE}/api/jobs/${job}`, {
      headers: { authorization: "Bearer sentinel-cron-secret" },
    });
    expect((await GET(req, context(job))).status).toBe(200);
  });

  it("returns 404 for an unknown job to an authorised operator", async () => {
    const res = await POST(
      post("nope", "", { authorization: "Bearer sentinel-cron-secret" }),
      context("nope")
    );
    expect(res.status).toBe(404);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await POST(
      post(job, "not json", { authorization: "Bearer sentinel-cron-secret" }),
      context(job)
    );
    expect(res.status).toBe(400);
  });

  it("passes the executor's status through so QStash retries on 500", async () => {
    mockExecute.mockResolvedValue({
      httpStatus: 500,
      status: "retry",
      attempt: 1,
      maxAttempts: 3,
      error: "Horizon unavailable",
    });
    const res = await POST(
      post(job, "{}", { "upstash-signature": sign(url, "{}") }),
      context(job)
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      status: "retry",
      error: "Horizon unavailable",
    });
  });
});
