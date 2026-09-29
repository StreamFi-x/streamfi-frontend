/**
 * @jest-environment node
 *
 * #1399 — Mux ↔ DB live-state reconciliation.
 */

jest.mock(
  "@vercel/postgres",
  () => jest.requireActual("@/testing/fake-postgres").vercelPostgresMock
);
jest.mock("@/lib/mux/server", () => ({
  listActiveMuxLiveStreamIds: jest.fn(),
  getMuxLiveStreamStatus: jest.fn(),
}));

import { fakePostgres as db } from "@/testing/fake-postgres";
import {
  IncompleteMuxListingError,
  alertOnAbnormalDrift,
  reconcileMuxLiveState,
  type MuxLiveStateSource,
  type ReconciliationConfig,
} from "@/lib/mux/reconciliation";
import { markMuxStreamLive, markMuxStreamOffline } from "@/lib/mux/live-state";
import { withTransaction } from "@/lib/postgres-transaction";
import {
  getMuxLiveStreamStatus,
  listActiveMuxLiveStreamIds,
} from "@/lib/mux/server";
import { GET as reconcileCron } from "@/app/api/routes-f/cron-mux-reconcile/route";
import {
  MemoryKvStore,
  setSecurityKvStoreForTesting,
} from "@/lib/security/kv-store";

const MIN = 60_000;
const CONFIG: ReconciliationConfig = {
  graceSeconds: 180,
  maxConfirmationsPerRun: 25,
  driftAlertThreshold: 5,
  persistentDriftRuns: 3,
};

const ORIGINAL_ENV = process.env;
const fetchMock = jest.fn();
let logs: string[] = [];
let spies: jest.SpyInstance[] = [];

function source(
  active: string[],
  statuses: Record<string, string> = {}
): MuxLiveStateSource & { getStatus: jest.Mock; listActive: jest.Mock } {
  return {
    listActive: jest.fn(async () => ({
      ids: new Set(active),
      complete: true,
      pages: 1,
    })),
    getStatus: jest.fn(async (id: string) => (statuses[id] ?? "idle") as never),
  };
}

/** A streamer whose live state last changed `ageMs` ago. */
function streamer(
  id: string,
  opts: {
    live: boolean;
    ageMs?: number;
    banned?: boolean;
    stream?: string | null;
  }
) {
  db.addUser({
    id,
    mux_stream_id: opts.stream === undefined ? `mux-${id}` : opts.stream,
    mux_playback_id: `pb-${id}`,
    creator: { title: `${id} live` },
    is_live: opts.live,
    is_banned: opts.banned ?? false,
    live_state_changed_at: new Date(
      db.clock.getTime() - (opts.ageMs ?? 60 * MIN)
    ),
  });
  if (opts.live) {
    db.state.stream_sessions.push({
      id: `open-${id}`,
      user_id: id,
      title: null,
      playback_id: null,
      mux_session_id: `mux-${id}`,
      started_at: new Date(db.clock.getTime() - 90 * MIN),
      ended_at: null,
    });
  }
}

const writes = () =>
  db.statements.filter(
    s => /^(UPDATE|INSERT|DELETE)/.test(s) && !s.includes("scheduled_job_runs")
  );

const corrections = () =>
  logs
    .map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(l => l?.message === "mux_reconciliation_correction");

beforeEach(() => {
  db.reset();
  logs = [];
  setSecurityKvStoreForTesting(new MemoryKvStore());
  process.env = {
    ...ORIGINAL_ENV,
    OPS_ALERT_WEBHOOK_URL: "https://hooks.example.test/ops",
    CRON_SECRET: "SENTINEL-cron-secret",
  };
  fetchMock.mockReset().mockResolvedValue(new Response("ok"));
  global.fetch = fetchMock as unknown as typeof fetch;
  spies = (["log", "warn", "error", "info"] as const).map(m =>
    jest.spyOn(console, m).mockImplementation((line: unknown) => {
      logs.push(String(line));
    })
  );
});

afterEach(() => spies.forEach(s => s.mockRestore()));
afterAll(() => {
  process.env = ORIGINAL_ENV;
  setSecurityKvStoreForTesting(null);
});

describe("drift detection in both directions", () => {
  it("does nothing when Mux and the DB agree", async () => {
    streamer("alice", { live: true });
    streamer("bob", { live: false });
    const summary = await reconcileMuxLiveState(source(["mux-alice"]), CONFIG);
    expect(summary).toMatchObject({ marked_offline: 0, marked_live: 0 });
    expect(writes()).toHaveLength(0);
  });

  it("ends a stream the DB thinks is live but Mux reports idle, closing its session", async () => {
    streamer("alice", { live: true });
    const src = source([], { "mux-alice": "idle" });

    const summary = await reconcileMuxLiveState(src, CONFIG);

    expect(summary).toMatchObject({ marked_offline: 1, sessions_closed: 1 });
    expect(src.getStatus).toHaveBeenCalledWith("mux-alice");
    expect(db.user("alice")).toMatchObject({
      is_live: false,
      stream_started_at: null,
      current_viewers: 0,
    });
    expect(db.openSessions("alice")).toHaveLength(0);
    expect(corrections()).toEqual([
      expect.objectContaining({
        source: "reconciliation",
        correction: "marked_offline",
        user_id: "alice",
        mux_stream_id: "mux-alice",
        previous_db_state: "live",
        observed_mux_state: "idle",
        reason: "db_live_but_mux_not_active",
      }),
    ]);
  });

  it("brings a stream live when Mux is broadcasting but the DB missed it", async () => {
    streamer("bob", { live: false });
    const summary = await reconcileMuxLiveState(source(["mux-bob"]), CONFIG);
    expect(summary).toMatchObject({ marked_live: 1, sessions_opened: 1 });
    expect(db.user("bob").is_live).toBe(true);
    expect(db.openSessions("bob")).toEqual([
      expect.objectContaining({ title: "bob live", playback_id: "pb-bob" }),
    ]);
    expect(corrections()[0]).toMatchObject({
      source: "reconciliation",
      correction: "marked_live",
      observed_mux_state: "active",
    });
  });

  it("ends a DB-live row that has no Mux stream at all without asking Mux", async () => {
    streamer("ghost", { live: true, stream: null });
    const src = source([]);
    const summary = await reconcileMuxLiveState(src, CONFIG);
    expect(summary.marked_offline).toBe(1);
    expect(src.getStatus).not.toHaveBeenCalled();
    expect(corrections()[0].reason).toBe("db_live_without_mux_stream");
  });

  it("treats a stream deleted on Mux as offline", async () => {
    streamer("alice", { live: true });
    await reconcileMuxLiveState(
      source([], { "mux-alice": "not_found" }),
      CONFIG
    );
    expect(db.user("alice").is_live).toBe(false);
  });

  it("never brings a banned streamer back live", async () => {
    streamer("banned", { live: false, banned: true });
    const summary = await reconcileMuxLiveState(source(["mux-banned"]), CONFIG);
    expect(summary).toMatchObject({ marked_live: 0, skipped_banned: 1 });
    expect(db.user("banned").is_live).toBe(false);
  });
});

describe("fail closed on bad Mux data", () => {
  it("writes nothing when the Mux listing fails", async () => {
    streamer("alice", { live: true });
    streamer("bob", { live: true });
    const src = source([]);
    src.listActive.mockRejectedValue(new Error("Mux 503"));
    await expect(reconcileMuxLiveState(src, CONFIG)).rejects.toThrow("Mux 503");
    expect(writes()).toHaveLength(0);
    expect(db.user("alice").is_live).toBe(true);
  });

  it("writes nothing when the listing was truncated", async () => {
    streamer("alice", { live: true });
    const src = source([]);
    src.listActive.mockResolvedValue({
      ids: new Set(),
      complete: false,
      pages: 50,
    });
    await expect(reconcileMuxLiveState(src, CONFIG)).rejects.toBeInstanceOf(
      IncompleteMuxListingError
    );
    expect(writes()).toHaveLength(0);
  });

  it("keeps a stream live when the confirmation lookup disagrees with the listing", async () => {
    streamer("alice", { live: true });
    const summary = await reconcileMuxLiveState(
      source([], { "mux-alice": "active" }),
      CONFIG
    );
    expect(summary).toMatchObject({
      marked_offline: 0,
      skipped_still_active: 1,
    });
    expect(db.user("alice").is_live).toBe(true);
  });

  it("skips (does not end) a stream whose confirmation lookup fails", async () => {
    streamer("alice", { live: true });
    const src = source([]);
    src.getStatus.mockRejectedValue(new Error("timeout"));
    const summary = await reconcileMuxLiveState(src, CONFIG);
    expect(summary).toMatchObject({
      marked_offline: 0,
      confirmation_failures: 1,
    });
    expect(db.user("alice").is_live).toBe(true);
  });

  it("bounds confirmation lookups per run and defers the rest", async () => {
    for (let i = 0; i < 4; i++) {
      streamer(`s${i}`, { live: true });
    }
    const src = source([]);
    const summary = await reconcileMuxLiveState(src, {
      ...CONFIG,
      maxConfirmationsPerRun: 2,
    });
    expect(src.getStatus).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ marked_offline: 2, deferred: 2 });
  });
});

describe("race protection", () => {
  it("does not end a stream that went live while the job was querying Mux", async () => {
    streamer("alice", { live: false });
    // T0: job captures the DB clock and lists Mux — alice is not active yet.
    // T1–T2: alice starts; the active webhook lands mid-run.
    const src = source([], { "mux-alice": "idle" });
    src.listActive.mockImplementation(async () => {
      db.advance(5_000);
      await withTransaction(tx => markMuxStreamLive(tx, "mux-alice"));
      return { ids: new Set<string>(), complete: true, pages: 1 };
    });

    // T3: the job must not write its stale "not active" observation.
    const summary = await reconcileMuxLiveState(src, CONFIG);

    expect(summary).toMatchObject({
      marked_offline: 0,
      skipped_recent_change: 1,
    });
    expect(db.user("alice").is_live).toBe(true);
    expect(db.openSessions("alice")).toHaveLength(1);
  });

  it("does not resurrect a stream that ended while the job was querying Mux", async () => {
    streamer("bob", { live: true });
    const src = source([]);
    src.listActive.mockImplementation(async () => {
      const listing = { ids: new Set(["mux-bob"]), complete: true, pages: 1 };
      db.advance(5_000);
      await withTransaction(tx => markMuxStreamOffline(tx, "mux-bob"));
      return listing;
    });

    const summary = await reconcileMuxLiveState(src, CONFIG);

    expect(summary).toMatchObject({ marked_live: 0, skipped_recent_change: 1 });
    expect(db.user("bob").is_live).toBe(false);
  });

  it("leaves rows alone inside the grace window and corrects them after it", async () => {
    streamer("alice", { live: true, ageMs: 60_000 });
    const src = source([], { "mux-alice": "idle" });

    const first = await reconcileMuxLiveState(src, CONFIG);
    expect(first).toMatchObject({
      marked_offline: 0,
      skipped_recent_change: 1,
    });

    db.advance(3 * MIN);
    const second = await reconcileMuxLiveState(src, CONFIG);
    expect(second.marked_offline).toBe(1);
  });

  it("honours a configured grace window", async () => {
    process.env.MUX_RECONCILE_GRACE_SECONDS = "900";
    streamer("alice", { live: true, ageMs: 10 * MIN });
    const { reconciliationConfigFromEnv } = jest.requireActual(
      "@/lib/mux/reconciliation"
    );
    const cfg = reconciliationConfigFromEnv();
    expect(cfg.graceSeconds).toBe(900);
    const summary = await reconcileMuxLiveState(
      source([], { "mux-alice": "idle" }),
      cfg
    );
    expect(summary.marked_offline).toBe(0);
  });

  it("does not open a second session when the missed webhook arrives after a correction", async () => {
    streamer("bob", { live: false });
    await reconcileMuxLiveState(source(["mux-bob"]), CONFIG);
    await withTransaction(tx => markMuxStreamLive(tx, "mux-bob"));
    expect(db.openSessions("bob")).toHaveLength(1);
  });
});

describe("drift alerting", () => {
  it("does not alert on isolated corrections", async () => {
    streamer("alice", { live: true });
    const summary = await reconcileMuxLiveState(
      source([], { "mux-alice": "idle" }),
      CONFIG
    );
    await alertOnAbnormalDrift(summary, 1, CONFIG);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alerts once when a run corrects an abnormal number of streams", async () => {
    for (let i = 0; i < 6; i++) {
      streamer(`s${i}`, { live: true });
    }
    const summary = await reconcileMuxLiveState(source([]), CONFIG);
    await alertOnAbnormalDrift(summary, 1, CONFIG);
    await alertOnAbnormalDrift(summary, 1, CONFIG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(
      "webhook delivery may be degraded"
    );
  });

  it("alerts when drift persists across consecutive runs", async () => {
    streamer("alice", { live: true });
    const summary = await reconcileMuxLiveState(
      source([], { "mux-alice": "idle" }),
      CONFIG
    );
    await alertOnAbnormalDrift(summary, 3, CONFIG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(
      "consecutive runs"
    );
  });
});

describe("cron route: scheduling, overlap and failure monitoring", () => {
  const listMock = listActiveMuxLiveStreamIds as jest.Mock;
  const statusMock = getMuxLiveStreamStatus as jest.Mock;
  const call = (auth = "Bearer SENTINEL-cron-secret") =>
    reconcileCron(
      new Request("http://localhost/api/routes-f/cron-mux-reconcile", {
        headers: { authorization: auth },
      })
    );

  beforeEach(() => {
    listMock
      .mockReset()
      .mockResolvedValue({ ids: new Set(), complete: true, pages: 1 });
    statusMock.mockReset().mockResolvedValue("idle");
  });

  it("rejects calls without the cron secret", async () => {
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("records a successful run", async () => {
    streamer("alice", { live: true });
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: "completed",
      consecutiveDriftRuns: 1,
    });
    expect(
      db.state.scheduled_job_runs.get("mux_live_reconciliation")
    ).toMatchObject({
      consecutive_failures: 0,
      lease_owner: null,
      last_summary: expect.objectContaining({ marked_offline: 1 }),
    });
  });

  it("makes failures observable and alerts on them", async () => {
    listMock.mockRejectedValue(new Error("Mux API unreachable"));
    const first = await call();
    expect(first.status).toBe(500);
    await call();
    const job = db.state.scheduled_job_runs.get("mux_live_reconciliation");
    expect(job).toMatchObject({
      consecutive_failures: 2,
      last_error: "Mux API unreachable",
      lease_owner: null,
    });
    // De-duplicated: one alert for the ongoing failure.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(
      "mux_live_reconciliation"
    );

    listMock.mockResolvedValue({ ids: new Set(), complete: true, pages: 1 });
    await call();
    expect(
      db.state.scheduled_job_runs.get("mux_live_reconciliation")
        ?.consecutive_failures
    ).toBe(0);
  });

  it("skips a run while another holds the lease", async () => {
    let finish!: () => void;
    listMock.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ ids: new Set(), complete: true, pages: 1 });
        })
    );
    const running = call();
    await new Promise(r => setTimeout(r, 10));
    const overlapping = await call();
    expect(await overlapping.json()).toEqual({
      status: "skipped",
      reason: "lease_held",
    });
    finish();
    expect((await running).status).toBe(200);
  });

  it("reclaims the lease after a crashed run's lease expires", async () => {
    db.state.scheduled_job_runs.set("mux_live_reconciliation", {
      job_name: "mux_live_reconciliation",
      lease_owner: "crashed-run",
      lease_expires_at: new Date(db.clock.getTime() - 1_000),
      consecutive_failures: 0,
      consecutive_drift_runs: 0,
    });
    expect(await (await call()).json()).toMatchObject({ status: "completed" });
  });
});
