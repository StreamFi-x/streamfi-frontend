/**
 * @jest-environment node
 *
 * #758: streams created by a timed-out createMuxStream call that no user
 * references are found by their passthrough tag and deleted.
 */
const mockList = jest.fn();
const mockDelete = jest.fn();
const mockSql = jest.fn();

jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
jest.mock("@/lib/mux/server", () => ({
  MUX_CREATE_PASSTHROUGH_PREFIX: "streamfi:create:",
  listMuxLiveStreamsPage: (...args: unknown[]) => mockList(...args),
  deleteMuxLiveStreamIfExists: (...args: unknown[]) => mockDelete(...args),
}));

import { runMuxOrphanSweep, ORPHAN_GRACE_MS } from "@/lib/mux/orphan-sweep";

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const OLD = new Date(NOW - ORPHAN_GRACE_MS - 60_000);
const FRESH = new Date(NOW - 60_000);
const ctx = { deadlineExpired: () => false };

function stream(
  id: string,
  over: Partial<{
    status: string;
    createdAt: Date;
    passthrough: string | null;
  }> = {}
) {
  return {
    id,
    status: "idle",
    createdAt: OLD,
    passthrough: "streamfi:create:abc",
    ...over,
  };
}

beforeEach(() => {
  mockList.mockReset();
  mockDelete.mockReset().mockResolvedValue("deleted");
  mockSql.mockReset().mockResolvedValue({ rows: [] });
});

it("deletes tagged, unreferenced, old streams only", async () => {
  mockList.mockResolvedValueOnce([
    stream("orphan"),
    stream("saved"),
    stream("fresh", { createdAt: FRESH }),
    stream("foreign", { passthrough: "someone-else" }),
    stream("untagged", { passthrough: null }),
  ]);
  mockSql.mockResolvedValueOnce({ rows: [{ mux_stream_id: "saved" }] });

  const result = await runMuxOrphanSweep(ctx, () => NOW);

  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith("orphan");
  expect(result.status).toBe("succeeded");
  expect(result.metrics).toMatchObject({
    tagged_streams: 3,
    referenced: 1,
    too_recent: 1,
    orphans_deleted: 1,
  });
});

it("never deletes an orphan that is actively broadcasting", async () => {
  mockList.mockResolvedValueOnce([stream("live", { status: "active" })]);
  const result = await runMuxOrphanSweep(ctx, () => NOW);
  expect(mockDelete).not.toHaveBeenCalled();
  expect(result.metrics.skipped_active).toBe(1);
  expect(result.alerts?.[0]).toMatch(/active/);
  expect(result.status).toBe("succeeded");
});

it("deletes nothing when the listing fails", async () => {
  mockList.mockRejectedValueOnce(new Error("mux down"));
  const result = await runMuxOrphanSweep(ctx, () => NOW);
  expect(mockDelete).not.toHaveBeenCalled();
  expect(mockSql).not.toHaveBeenCalled();
  expect(result.status).toBe("partial");
  expect(result.detail?.listing_error).toBe("mux down");
});

it("reports partial when a delete fails and keeps going", async () => {
  mockList.mockResolvedValueOnce([stream("a"), stream("b")]);
  mockDelete.mockRejectedValueOnce(new Error("boom"));
  const result = await runMuxOrphanSweep(ctx, () => NOW);
  expect(mockDelete).toHaveBeenCalledTimes(2);
  expect(result.status).toBe("partial");
  expect(result.metrics).toMatchObject({
    orphans_deleted: 1,
    delete_failed: 1,
  });
  expect(result.detail?.delete_failed_ids).toEqual(["a"]);
});

it("pages through the whole listing", async () => {
  const page1 = Array.from({ length: 100 }, (_, i) =>
    stream(`p1-${i}`, { passthrough: null })
  );
  mockList.mockResolvedValueOnce(page1).mockResolvedValueOnce([stream("late")]);
  await runMuxOrphanSweep(ctx, () => NOW);
  expect(mockList).toHaveBeenCalledTimes(2);
  expect(mockDelete).toHaveBeenCalledWith("late");
});
