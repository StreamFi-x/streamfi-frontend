/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn(),
}));
jest.mock("@/lib/routes-f/price", () => ({ getXlmUsdPrice: jest.fn() }));
jest.mock("@/lib/jobs/scheduled-job", () => ({
  ...jest.requireActual("@/lib/jobs/scheduled-job"),
  runScheduledJob: jest.fn(),
}));
jest.mock("@/lib/stellar/tip-reconciliation", () => ({
  reconcileStaleTipTotals: jest.fn(),
}));

import { NextRequest } from "next/server";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { runScheduledJob } from "@/lib/jobs/scheduled-job";
import { reconcileStaleTipTotals } from "@/lib/stellar/tip-reconciliation";
import { GET } from "../route";

const runJob = runScheduledJob as jest.Mock;
const ORIGINAL_ENV = process.env;

function request(authorization?: string) {
  return new NextRequest(
    "http://localhost/api/routes-f/cron-reconcile-tip-totals",
    {
      headers: authorization ? { authorization } : {},
    }
  );
}

describe("GET /api/routes-f/cron-reconcile-tip-totals", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-cron-secret" };
    runJob.mockResolvedValue({
      job: "tip-total-reconciliation",
      status: "succeeded",
      startedAt: "2026-09-25T00:00:00.000Z",
      durationMs: 5,
      metrics: { selected: 1, reconciled: 1 },
      alerts: [],
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects requests without the cron secret", async () => {
    expect((await GET(request("Bearer nope"))).status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });

  it("runs the reconciliation under a lease with bounded batch settings", async () => {
    process.env.TIP_RECONCILE_BATCH_SIZE = "40";

    const res = await GET(request("Bearer test-cron-secret"));

    expect(res.status).toBe(200);
    expect((await res.json()).metrics).toEqual({ selected: 1, reconciled: 1 });
    const options = runJob.mock.calls[0][0];
    expect(options.name).toBe("tip-total-reconciliation");

    await options.run();
    const jobOptions = (reconcileStaleTipTotals as jest.Mock).mock.calls[0][0];
    expect(jobOptions).toEqual(
      expect.objectContaining({
        batchSize: 40,
        staleAfterMinutes: 360,
        concurrency: 2,
      })
    );
    await jobOptions.onTotalsChanged("user-9");
    expect(evaluateAndAwardBadges).toHaveBeenCalledWith("user-9");
  });

  it("ignores invalid batch settings", async () => {
    process.env.TIP_RECONCILE_BATCH_SIZE = "-3";
    await GET(request("Bearer test-cron-secret"));
    await runJob.mock.calls[0][0].run();
    expect(
      (reconcileStaleTipTotals as jest.Mock).mock.calls[0][0].batchSize
    ).toBe(25);
  });
});
