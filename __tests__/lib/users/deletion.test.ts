/**
 * @jest-environment node
 */
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/mux/server", () => ({
  deleteMuxAssetIfExists: jest.fn(async () => "deleted"),
  deleteMuxLiveStreamIfExists: jest.fn(async () => "deleted"),
  disableMuxStream: jest.fn(async () => ({ success: true })),
  enableMuxStream: jest.fn(async () => ({ success: true })),
}));
jest.mock("@/utils/upload/cloudinary", () => ({
  deleteImage: jest.fn(async () => undefined),
  extractPublicIdFromUrl: jest.requireActual("@/utils/upload/cloudinary")
    .extractPublicIdFromUrl,
}));
jest.mock("@/lib/stellar/horizon", () => ({
  getAccountBalances: jest.fn(async () => null),
}));

import {
  deleteMuxAssetIfExists,
  deleteMuxLiveStreamIfExists,
  disableMuxStream,
  enableMuxStream,
} from "@/lib/mux/server";
import { deleteImage } from "@/utils/upload/cloudinary";
import { getAccountBalances } from "@/lib/stellar/horizon";
import {
  cancelAccountDeletion,
  deletionGraceDays,
  purgeDueDeletions,
  requestAccountDeletion,
} from "@/lib/users/deletion";

const USER = "11111111-1111-1111-1111-111111111111";
const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

function deletion(overrides: Record<string, unknown> = {}) {
  return {
    id: "del-1",
    user_id: USER,
    status: "purging",
    completed_steps: [],
    attempts: 1,
    legal_hold: false,
    ...overrides,
  };
}

/** Wire the per-user purge queries for a straightforward purge. */
function stubPurgeQueries({
  custodial = false,
  legalHold = false,
}: { custodial?: boolean; legalHold?: boolean } = {}) {
  mockDb.on(/SELECT wallet, encrypted_stellar_key IS NOT NULL AS custodial/, {
    rows: [{ wallet: WALLET, custodial }],
  });
  mockDb.on(/SELECT legal_hold FROM user_deletions/, {
    rows: [{ legal_hold: legalHold }],
  });
  mockDb.on(/SELECT mux_asset_id FROM stream_recordings/, {
    rows: [{ mux_asset_id: "asset-1" }, { mux_asset_id: "asset-2" }],
  });
  mockDb.on(/SELECT mux_stream_id FROM users/, {
    rows: [{ mux_stream_id: "ls-1" }],
  });
  mockDb.on(/SELECT avatar, banner/, {
    rows: [
      {
        avatar: "https://res.cloudinary.com/demo/image/upload/v1/avatars/a.png",
        banner: null,
        thumbnail: "https://example.com/preset.png",
      },
    ],
  });
  mockDb.on(/array_append\(completed_steps/, { rowCount: 1 });
  mockDb.on(/streamfi_purge_user/, { rows: [{}] });
  mockDb.on(/SET status = 'failed'/, { rowCount: 1 });
  mockDb.on(/SET status = 'pending', claimed_until = NULL/, { rowCount: 1 });
}

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.ACCOUNT_DELETION_GRACE_DAYS;
});

describe("requestAccountDeletion", () => {
  it("tombstones the user, records the request and disables the stream", async () => {
    mockDb.on(/WITH target AS/, {
      rows: [
        {
          id: "del-1",
          user_id: USER,
          status: "pending",
          purge_after: "2026-10-25",
          mux_stream_id: "ls-1",
        },
      ],
    });

    const result = await requestAccountDeletion({
      userId: USER,
      requestedByType: "self",
      requestedBy: USER,
    });

    expect(result.outcome).toBe("created");
    const [call] = mockDb.callsMatching(/WITH target AS/);
    expect(call.text).toMatch(/deleted_at IS NULL FOR UPDATE/);
    expect(call.text).toMatch(/ON CONFLICT DO NOTHING/);
    expect(call.values).toContain(30);
    expect(disableMuxStream).toHaveBeenCalledWith("ls-1");
  });

  it("is idempotent: a second request returns the open deletion", async () => {
    mockDb.on(/WITH target AS/, { rows: [] });
    mockDb.on(/status IN \('pending', 'purging', 'failed'\)/, {
      rows: [deletion({ status: "pending" })],
    });
    const result = await requestAccountDeletion({
      userId: USER,
      requestedByType: "admin",
      requestedBy: "admin-1",
    });
    expect(result.outcome).toBe("already_pending");
    expect(disableMuxStream).not.toHaveBeenCalled();
  });

  it("reports an unknown user", async () => {
    mockDb.on(/WITH target AS/, { rows: [] });
    mockDb.on(/status IN \('pending', 'purging', 'failed'\)/, { rows: [] });
    expect(
      (
        await requestAccountDeletion({
          userId: USER,
          requestedByType: "self",
          requestedBy: USER,
        })
      ).outcome
    ).toBe("not_found");
  });

  it("does not fail the request when Mux cannot be reached", async () => {
    (disableMuxStream as jest.Mock).mockRejectedValueOnce(
      new Error("mux down")
    );
    mockDb.on(/WITH target AS/, {
      rows: [{ id: "del-1", user_id: USER, mux_stream_id: "ls-1" }],
    });
    await expect(
      requestAccountDeletion({
        userId: USER,
        requestedByType: "self",
        requestedBy: USER,
      })
    ).resolves.toMatchObject({ outcome: "created" });
  });

  it("uses a configurable grace window with a safe default", () => {
    expect(deletionGraceDays()).toBe(30);
    process.env.ACCOUNT_DELETION_GRACE_DAYS = "14";
    expect(deletionGraceDays()).toBe(14);
    process.env.ACCOUNT_DELETION_GRACE_DAYS = "0";
    expect(deletionGraceDays()).toBe(30);
  });
});

describe("cancelAccountDeletion", () => {
  it("restores the account in the same statement and re-enables the stream", async () => {
    mockDb.on(/WITH c AS/, { rows: [{ id: USER, mux_stream_id: "ls-1" }] });
    const result = await cancelAccountDeletion({
      userId: USER,
      cancelledBy: USER,
    });
    expect(result.outcome).toBe("cancelled");
    const [call] = mockDb.callsMatching(/WITH c AS/);
    expect(call.text).toMatch(/cardinality\(completed_steps\) = 0/);
    expect(call.text).toMatch(/SET deleted_at = NULL/);
    expect(enableMuxStream).toHaveBeenCalledWith("ls-1");
  });

  it.each([
    ["cancelled", "already_cancelled"],
    ["purging", "purge_in_progress"],
    ["failed", "purge_in_progress"],
    ["purged", "already_purged"],
  ])("maps a %s deletion to %s", async (status, outcome) => {
    mockDb.on(/WITH c AS/, { rows: [] });
    mockDb.on(/ORDER BY requested_at DESC/, { rows: [{ status }] });
    expect(
      (await cancelAccountDeletion({ userId: USER, cancelledBy: USER })).outcome
    ).toBe(outcome);
    expect(enableMuxStream).not.toHaveBeenCalled();
  });

  it("reports no deletion at all", async () => {
    mockDb.on(/WITH c AS/, { rows: [] });
    mockDb.on(/ORDER BY requested_at DESC/, { rows: [] });
    expect(
      (await cancelAccountDeletion({ userId: USER, cancelledBy: USER })).outcome
    ).toBe("not_found");
  });
});

describe("purgeDueDeletions", () => {
  const run = (deadlineExpired = () => false) =>
    purgeDueDeletions({ batchSize: 10, deadlineExpired });

  it("claims only due, unheld deletions with SKIP LOCKED", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [] });
    await run();
    const [claim] = mockDb.callsMatching(/SET status = 'purging'/);
    expect(claim.text).toMatch(/purge_after <= now\(\)/);
    expect(claim.text).toMatch(/legal_hold = false/);
    expect(claim.text).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(claim.text).toMatch(
      /status = 'purging' AND claimed_until < now\(\)/
    );
  });

  it("runs every step in order and finishes with the database purge", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [deletion()] });
    stubPurgeQueries();

    const metrics = await run();

    expect(metrics).toMatchObject({ claimed: 1, purged: 1, failed: 0 });
    expect(deleteMuxAssetIfExists).toHaveBeenCalledTimes(2);
    expect(deleteMuxLiveStreamIfExists).toHaveBeenCalledWith("ls-1");
    // Only the Cloudinary upload is deleted, not the preset icon.
    expect(deleteImage).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith("avatars/a");
    const steps = mockDb
      .callsMatching(/array_append\(completed_steps/)
      .map(c => c.values[0]);
    expect(steps).toEqual(["mux_assets", "mux_live_stream", "media"]);
    expect(mockDb.callsMatching(/streamfi_purge_user/)).toHaveLength(1);
  });

  it("resumes after a partial purge without repeating completed steps", async () => {
    mockDb.on(/SET status = 'purging'/, {
      rows: [deletion({ completed_steps: ["mux_assets", "mux_live_stream"] })],
    });
    stubPurgeQueries();

    await run();

    expect(deleteMuxAssetIfExists).not.toHaveBeenCalled();
    expect(deleteMuxLiveStreamIfExists).not.toHaveBeenCalled();
    expect(mockDb.callsMatching(/streamfi_purge_user/)).toHaveLength(1);
  });

  it("records a failure and keeps going with the next user", async () => {
    mockDb.on(/SET status = 'purging'/, {
      rows: [deletion({ id: "del-1" }), deletion({ id: "del-2" })],
    });
    stubPurgeQueries();
    (deleteMuxAssetIfExists as jest.Mock).mockRejectedValueOnce(
      new Error("rate limited")
    );

    const metrics = await run();

    expect(metrics).toMatchObject({ claimed: 2, purged: 1, failed: 1 });
    const [failure] = mockDb.callsMatching(/SET status = 'failed'/);
    expect(failure.values).toEqual(["rate limited", "del-1"]);
    expect(failure.text).toMatch(/AND status = 'purging'/);
  });

  it("marks a database-step failure as failed, never purged", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [deletion()] });
    stubPurgeQueries();
    mockDb.once(/streamfi_purge_user/, () => {
      throw new Error("purge aborted: foreign key x has no purge policy");
    });

    const metrics = await run();

    expect(metrics).toMatchObject({ purged: 0, failed: 1 });
  });

  it("stops before the next irreversible step when a legal hold appears", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [deletion()] });
    stubPurgeQueries({ legalHold: true });

    const metrics = await run();

    expect(metrics.released_for_legal_hold).toBe(1);
    expect(deleteMuxAssetIfExists).not.toHaveBeenCalled();
    expect(
      mockDb.callsMatching(/SET status = 'pending', claimed_until = NULL/)
    ).toHaveLength(1);
  });

  it("refuses to destroy a custodial key while the wallet holds funds", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [deletion()] });
    stubPurgeQueries({ custodial: true });
    (getAccountBalances as jest.Mock).mockResolvedValueOnce([
      { assetType: "native", balance: "250.0000000" },
    ]);

    const metrics = await run();

    expect(metrics.failed).toBe(1);
    expect(deleteMuxAssetIfExists).not.toHaveBeenCalled();
    const [failure] = mockDb.callsMatching(/SET status = 'failed'/);
    expect(String(failure.values[0])).toMatch(
      /custodial wallet still holds funds/
    );
  });

  it("allows the purge when a custodial wallet only holds the reserve", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [deletion()] });
    stubPurgeQueries({ custodial: true });
    (getAccountBalances as jest.Mock).mockResolvedValueOnce([
      { assetType: "native", balance: "1.5000000" },
    ]);
    expect((await run()).purged).toBe(1);
  });

  it("treats a Horizon outage as a failure, not as an empty wallet", async () => {
    mockDb.on(/SET status = 'purging'/, { rows: [deletion()] });
    stubPurgeQueries({ custodial: true });
    (getAccountBalances as jest.Mock).mockRejectedValueOnce(
      new Error("timeout")
    );
    expect((await run()).failed).toBe(1);
    expect(deleteMuxAssetIfExists).not.toHaveBeenCalled();
  });

  it("leaves claimed work for the next run when the time budget runs out", async () => {
    mockDb.on(/SET status = 'purging'/, {
      rows: [deletion({ id: "del-1" }), deletion({ id: "del-2" })],
    });
    stubPurgeQueries();
    let calls = 0;
    const metrics = await run(() => ++calls > 1);
    expect(metrics).toMatchObject({ purged: 1, skipped_deadline: 1 });
  });
});
