/**
 * @jest-environment node
 */
import { createSqlMock, type SqlCall } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/mux/server", () => ({
  listMuxAssetsPage: jest.fn(),
  retrieveMuxAsset: jest.fn(),
  deleteMuxAssetIfExists: jest.fn(async () => "deleted"),
}));
jest.mock("@/lib/mux/recordings", () => ({
  upsertRecordingFromAsset: jest.fn(async () => true),
}));

import {
  deleteMuxAssetIfExists,
  listMuxAssetsPage,
  retrieveMuxAsset,
  type MuxAssetSummary,
} from "@/lib/mux/server";
import { upsertRecordingFromAsset } from "@/lib/mux/recordings";
import {
  MUX_ORPHAN_GRACE_MS,
  remediateFinding,
  runMuxReconciliation,
} from "@/lib/mux/reconciliation";

const NOW = new Date("2026-09-25T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const OLD = new Date(NOW.getTime() - MUX_ORPHAN_GRACE_MS - 6 * HOUR);

const listPage = listMuxAssetsPage as jest.Mock;
const retrieve = retrieveMuxAsset as jest.Mock;

function asset(id: string, overrides: Partial<MuxAssetSummary> = {}) {
  return {
    id,
    status: "ready",
    createdAt: OLD,
    liveStreamId: "ls-1",
    isLive: false,
    playbackId: `pb-${id}`,
    ...overrides,
  };
}

function recording(id: string, assetId: string, createdAt = OLD) {
  return {
    id,
    mux_asset_id: assetId,
    playback_id: `pb-${assetId}`,
    owner_id: "user-1",
    status: "ready",
    created_at: createdAt.toISOString(),
  };
}

const ctx = (deadlineExpired: () => boolean = () => false) => ({
  runId: "run-1",
  deadlineExpired,
  renewLease: jest.fn(async () => true),
});

/**
 * DB state: which asset ids have rows (optionally a second set that appears
 * between the first and second lookup), the recordings table and open findings.
 */
function stubDb({
  recorded = [] as string[],
  lateRecorded = [] as string[],
  recordings = [] as ReturnType<typeof recording>[],
  clips = [] as ReturnType<typeof recording>[],
  openOrphanFindings = [] as Array<{ id: string; mux_asset_id: string }>,
  findingInserted = true,
} = {}) {
  let lookups = 0;
  mockDb.on(/SELECT now\(\) AS now/, { rows: [{ now: NOW.toISOString() }] });
  mockDb.on(
    /SELECT mux_asset_id FROM stream_recordings WHERE mux_asset_id IN/,
    (call: SqlCall) => {
      lookups++;
      const ids: string[] = JSON.parse(String(call.values[0]));
      const present = new Set(
        lookups === 1 ? recorded : [...recorded, ...lateRecorded]
      );
      return {
        rows: ids
          .filter(id => present.has(id))
          .map(id => ({ mux_asset_id: id })),
      };
    }
  );
  mockDb.on(/SELECT id, mux_stream_id FROM users/, {
    rows: [{ id: "user-1", mux_stream_id: "ls-1" }],
  });
  mockDb.on(/INSERT INTO mux_drift_findings/, {
    rows: [{ inserted: findingInserted }],
  });
  mockDb.on(/database row now exists/, { rowCount: 0 });
  mockDb.on(/SELECT id, mux_asset_id FROM mux_drift_findings/, {
    rows: openOrphanFindings,
  });
  mockDb.on(/asset no longer exists in Mux/, { rowCount: 1 });
  mockDb.once(/FROM stream_recordings WHERE id > /, { rows: recordings });
  mockDb.on(/FROM stream_recordings WHERE id > /, { rows: [] });
  mockDb.once(/FROM stream_clips WHERE id > /, { rows: clips });
  mockDb.on(/FROM stream_clips WHERE id > /, { rows: [] });
  mockDb.on(/WITH finding AS/, { rows: [] });
  mockDb.on(/SELECT f.id, f.mux_asset_id, CASE WHEN f.row_table/, { rows: [] });
}

const findingInserts = () =>
  mockDb.callsMatching(/INSERT INTO mux_drift_findings/).map(c => ({
    kind: c.values[0],
    assetId: c.values[1],
    rowTable: c.values[2],
    rowId: c.values[3],
    userId: c.values[5],
  }));

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  retrieve.mockResolvedValue(null);
});

describe("runMuxReconciliation", () => {
  it("reports nothing when every asset and row match", async () => {
    listPage.mockResolvedValueOnce([asset("a1"), asset("a2")]);
    stubDb({
      recorded: ["a1", "a2"],
      recordings: [recording("r1", "a1"), recording("r2", "a2")],
    });

    const { status, metrics } = await runMuxReconciliation(ctx());

    expect(status).toBe("completed");
    expect(metrics).toMatchObject({
      mux_assets_listed: 2,
      listing_complete: true,
      matched: 2,
      mux_asset_without_db_row: 0,
      db_row_without_mux_asset: 0,
    });
    expect(findingInserts()).toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("flags a settled Mux asset with no row, attributed to its owner", async () => {
    listPage.mockResolvedValueOnce([asset("orphan")]);
    stubDb();

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.mux_asset_without_db_row).toBe(1);
    expect(findingInserts()).toEqual([
      {
        kind: "MUX_ASSET_WITHOUT_DB_ROW",
        assetId: "orphan",
        rowTable: null,
        rowId: null,
        userId: "user-1",
      },
    ]);
    expect(deleteMuxAssetIfExists).not.toHaveBeenCalled();
  });

  it("does not flag assets still inside the propagation grace period", async () => {
    listPage.mockResolvedValueOnce([
      asset("fresh", { createdAt: new Date(NOW.getTime() - HOUR) }),
      asset("preparing", { status: "preparing" }),
      asset("live", { isLive: true }),
    ]);
    stubDb();

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.recent_propagation).toBe(3);
    expect(findingInserts()).toEqual([]);
  });

  it("does not flag an asset whose row lands while the sweep runs", async () => {
    listPage.mockResolvedValueOnce([asset("racing")]);
    stubDb({ lateRecorded: ["racing"] });

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.mux_asset_without_db_row).toBe(0);
    expect(findingInserts()).toEqual([]);
  });

  it("paginates the asset list until a short page", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => asset(`p1-${i}`));
    listPage
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce([asset("p2-0")]);
    stubDb({ recorded: [...page1.map(a => a.id), "p2-0"] });

    const { metrics } = await runMuxReconciliation(ctx());

    expect(listPage).toHaveBeenNthCalledWith(1, 1, 100);
    expect(listPage).toHaveBeenNthCalledWith(2, 2, 100);
    expect(metrics).toMatchObject({
      mux_assets_listed: 101,
      listing_complete: true,
    });
  });

  it("never treats a failed listing as missing assets", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => asset(`p1-${i}`));
    listPage
      .mockResolvedValueOnce(page1)
      .mockRejectedValueOnce(
        Object.assign(new Error("Too Many Requests"), { status: 429 })
      );
    stubDb({
      recorded: page1.map(a => a.id),
      recordings: [recording("r-unlisted", "on-page-2")],
    });

    const { status, metrics } = await runMuxReconciliation(ctx());

    expect(status).toBe("partial");
    expect(metrics.listing_complete).toBe(false);
    expect(metrics.listing_error).toMatch(/Too Many Requests/);
    expect(metrics.direction_b_skipped).toBe(true);
    expect(retrieve).not.toHaveBeenCalled();
    expect(findingInserts()).toEqual([]);
  });

  it("stops listing when the time budget is exhausted", async () => {
    stubDb();
    const { status, metrics } = await runMuxReconciliation(ctx(() => true));
    expect(status).toBe("partial");
    expect(listPage).not.toHaveBeenCalled();
    expect(metrics.direction_b_skipped).toBe(true);
  });

  it("flags a row only after a direct 404 and then attempts the guarded auto-hide", async () => {
    listPage.mockResolvedValueOnce([]);
    stubDb({ recordings: [recording("r-dead", "gone")] });
    retrieve.mockResolvedValueOnce(null);

    const { metrics } = await runMuxReconciliation(ctx());

    expect(retrieve).toHaveBeenCalledWith("gone");
    expect(metrics.db_row_without_mux_asset).toBe(1);
    expect(findingInserts()).toEqual([
      {
        kind: "DB_ROW_WITHOUT_MUX_ASSET",
        assetId: "gone",
        rowTable: "stream_recordings",
        rowId: "r-dead",
        userId: "user-1",
      },
    ]);
    const hide = mockDb.callsMatching(/WITH finding AS/)[0];
    expect(hide.text).toMatch(/detection_count >= 2/);
    expect(hide.text).toMatch(/first_detected_at <= /);
  });

  it("sweeps stream_clips rows the same way and hides through the clips table", async () => {
    listPage.mockResolvedValueOnce([]);
    stubDb({ clips: [recording("clip-1", "clip-asset-gone")] });
    retrieve.mockResolvedValueOnce(null);

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.db_row_without_mux_asset).toBe(1);
    expect(findingInserts()).toEqual([
      {
        kind: "DB_ROW_WITHOUT_MUX_ASSET",
        assetId: "clip-asset-gone",
        rowTable: "stream_clips",
        rowId: "clip-1",
        userId: "user-1",
      },
    ]);
    const [scan] = mockDb.callsMatching(/FROM stream_clips WHERE id > /);
    expect(scan.text).toMatch(/mux_asset_id IS NOT NULL/);
    const hide = mockDb.callsMatching(/WITH finding AS/)[0];
    expect(hide.text).toMatch(/UPDATE stream_clips c/);
  });

  it("treats an asset referenced by a clip as matched", async () => {
    listPage.mockResolvedValueOnce([asset("clip-asset")]);
    stubDb({ recorded: ["clip-asset"] });
    const [{ metrics }] = [await runMuxReconciliation(ctx())];
    expect(metrics.mux_asset_without_db_row).toBe(0);
    const [lookup] = mockDb.callsMatching(/WHERE mux_asset_id IN/);
    expect(lookup.text).toMatch(/UNION SELECT mux_asset_id FROM stream_clips/);
  });

  it("records a failed check instead of a missing asset when Mux errors", async () => {
    listPage.mockResolvedValueOnce([]);
    stubDb({ recordings: [recording("r1", "unknown")] });
    retrieve.mockRejectedValueOnce(new Error("timeout"));

    const { status, metrics } = await runMuxReconciliation(ctx());

    expect(status).toBe("partial");
    expect(metrics).toMatchObject({
      check_failed: 1,
      check_failed_asset_ids: ["unknown"],
      db_row_without_mux_asset: 0,
    });
    expect(findingInserts()).toEqual([]);
  });

  it("ignores a row whose asset exists but was missed by the listing", async () => {
    listPage.mockResolvedValueOnce([]);
    stubDb({ recordings: [recording("r1", "created-mid-listing")] });
    retrieve.mockResolvedValueOnce(asset("created-mid-listing"));

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.db_row_without_mux_asset).toBe(0);
    expect(findingInserts()).toEqual([]);
  });

  it("skips rows younger than the DB grace period", async () => {
    listPage.mockResolvedValueOnce([]);
    stubDb({
      recordings: [
        recording(
          "r-new",
          "just-written",
          new Date(NOW.getTime() - 10 * 60 * 1000)
        ),
      ],
    });

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.recent_propagation).toBe(1);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("is repeat-safe: a known finding is updated, not duplicated", async () => {
    listPage.mockResolvedValueOnce([asset("orphan")]);
    stubDb({ findingInserted: false });

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.mux_asset_without_db_row).toBe(1);
    expect(metrics.new_findings).toBe(0);
    const [upsert] = mockDb.callsMatching(/INSERT INTO mux_drift_findings/);
    expect(upsert.text).toMatch(
      /ON CONFLICT \(kind, mux_asset_id\) WHERE status = 'open'/
    );
  });

  it("resolves an open orphan finding once Mux confirms the asset is gone", async () => {
    listPage.mockResolvedValueOnce([]);
    stubDb({
      openOrphanFindings: [{ id: "f1", mux_asset_id: "deleted-in-dashboard" }],
    });
    retrieve.mockResolvedValueOnce(null);

    const { metrics } = await runMuxReconciliation(ctx());

    expect(metrics.findings_resolved).toBe(1);
  });
});

describe("remediateFinding", () => {
  const orphanFinding = {
    id: "f1",
    kind: "MUX_ASSET_WITHOUT_DB_ROW",
    status: "open",
    mux_asset_id: "orphan",
  };
  const missingFinding = {
    id: "f2",
    kind: "DB_ROW_WITHOUT_MUX_ASSET",
    status: "remediated",
    mux_asset_id: "gone",
    row_table: "stream_recordings",
    row_id: "r1",
    previous_status: "ready",
  };

  beforeEach(() => {
    mockDb.on(/UPDATE mux_drift_findings/, { rowCount: 1 });
  });

  it("refuses to delete an asset that a recording now references", async () => {
    mockDb.on(/SELECT \* FROM mux_drift_findings/, { rows: [orphanFinding] });
    mockDb.on(/SELECT 1 FROM stream_recordings/, { rows: [{ "?column?": 1 }] });

    const result = await remediateFinding("f1", "delete_mux_asset", "admin:a");

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(deleteMuxAssetIfExists).not.toHaveBeenCalled();
  });

  it("deletes a still-orphaned asset on explicit request", async () => {
    mockDb.on(/SELECT \* FROM mux_drift_findings/, { rows: [orphanFinding] });
    mockDb.on(/SELECT 1 FROM stream_recordings/, { rows: [] });

    const result = await remediateFinding("f1", "delete_mux_asset", "admin:a");

    expect(result).toEqual({ ok: true, action: "delete_mux_asset" });
    expect(deleteMuxAssetIfExists).toHaveBeenCalledWith("orphan");
    const close = mockDb.callsMatching(/UPDATE mux_drift_findings/)[0];
    expect(close.text).toMatch(/status = 'open'/);
    expect(close.values).toContain("admin:a");
  });

  it("adopts an asset only for an active owner", async () => {
    mockDb.on(/SELECT \* FROM mux_drift_findings/, { rows: [orphanFinding] });
    retrieve.mockResolvedValue(asset("orphan"));
    mockDb.once(/SELECT id FROM users/, { rows: [] });

    expect(await remediateFinding("f1", "adopt", "admin:a")).toMatchObject({
      ok: false,
      status: 422,
    });

    mockDb.once(/SELECT id FROM users/, { rows: [{ id: "user-1" }] });
    expect(await remediateFinding("f1", "adopt", "admin:a")).toEqual({
      ok: true,
      action: "adopt",
    });
    expect(upsertRecordingFromAsset).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", assetId: "orphan" })
    );
  });

  it("restores a hidden recording only when the asset exists again", async () => {
    mockDb.on(/SELECT \* FROM mux_drift_findings/, { rows: [missingFinding] });
    retrieve.mockResolvedValueOnce(null);
    expect(await remediateFinding("f2", "restore", "admin:a")).toMatchObject({
      ok: false,
      status: 422,
    });

    retrieve.mockResolvedValueOnce(asset("gone"));
    mockDb.on(/UPDATE stream_recordings/, { rowCount: 1 });
    expect(await remediateFinding("f2", "restore", "admin:a")).toEqual({
      ok: true,
      action: "restore",
    });
    const restore = mockDb.callsMatching(/UPDATE stream_recordings/)[0];
    expect(restore.values).toContain("ready");
  });

  it("rejects actions on closed findings and unknown ids", async () => {
    mockDb.once(/SELECT \* FROM mux_drift_findings/, {
      rows: [{ ...orphanFinding, status: "dismissed" }],
    });
    expect(await remediateFinding("f1", "dismiss", "admin:a")).toMatchObject({
      ok: false,
      status: 409,
    });
    mockDb.once(/SELECT \* FROM mux_drift_findings/, { rows: [] });
    expect(await remediateFinding("nope", "dismiss", "admin:a")).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});
