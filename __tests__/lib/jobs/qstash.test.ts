/**
 * @jest-environment node
 */
const mockPublishJSON = jest.fn();
jest.mock("@upstash/qstash", () => ({
  ...jest.requireActual("@upstash/qstash"),
  Client: jest.fn(() => ({ publishJSON: mockPublishJSON })),
}));
jest.mock("@/lib/tracing/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { defineJob, noPayload } from "@/lib/jobs/definition";
import { dispatchJob, jobUrl, resetQStashForTests } from "@/lib/jobs/qstash";

const job = defineJob({
  name: "demo-job",
  description: "x",
  maxAttempts: 4,
  timeoutSeconds: 30,
  leaseSeconds: 45,
  parsePayload: noPayload,
  run: async () => ({ status: "succeeded", metrics: {} }),
});

beforeEach(() => {
  delete process.env.JOBS_BASE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.QSTASH_TOKEN;
  resetQStashForTests();
  mockPublishJSON.mockReset();
});

describe("dispatchJob", () => {
  it("reports not_configured instead of throwing without QStash", async () => {
    expect(await dispatchJob(job, {})).toEqual({
      dispatched: false,
      reason: "not_configured",
    });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("publishes to the job's URL with its retry budget and timeout", async () => {
    process.env.QSTASH_TOKEN = "sentinel-qstash-token";
    process.env.NEXT_PUBLIC_APP_URL = "https://streamfi.test/";
    mockPublishJSON.mockResolvedValue({ messageId: "msg-9" });

    const result = await dispatchJob(
      job,
      {},
      { deduplicationId: "dedup-1", delaySeconds: 30 }
    );

    expect(result).toEqual({ dispatched: true, messageId: "msg-9" });
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://streamfi.test/api/jobs/demo-job",
      body: {},
      retries: 3,
      timeout: 45,
      deduplicationId: "dedup-1",
      delay: 30,
    });
  });

  it("reports a publish failure without throwing", async () => {
    process.env.QSTASH_TOKEN = "sentinel-qstash-token";
    process.env.JOBS_BASE_URL = "https://jobs.streamfi.test";
    mockPublishJSON.mockRejectedValue(new Error("quota exceeded"));

    expect(await dispatchJob(job, {})).toEqual({
      dispatched: false,
      reason: "error",
      error: "quota exceeded",
    });
  });

  it("prefers JOBS_BASE_URL over the app URL", () => {
    process.env.JOBS_BASE_URL = "https://jobs.streamfi.test";
    process.env.NEXT_PUBLIC_APP_URL = "https://streamfi.test";
    expect(jobUrl("demo-job")).toBe(
      "https://jobs.streamfi.test/api/jobs/demo-job"
    );
  });
});
