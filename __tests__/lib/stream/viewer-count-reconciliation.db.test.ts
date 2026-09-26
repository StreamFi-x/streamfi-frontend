/**
 * @jest-environment node
 *
 * #1403 current_viewers reconciliation against real PostgreSQL.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));

import { sql } from "@vercel/postgres";
import { reconcileViewerCounts } from "@/lib/stream/viewer-count-reconciliation";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";

jest.setTimeout(30_000);

describeWithDb("reconcileViewerCounts (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("viewercounts");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
  });

  afterEach(async () => {
    await schema.drop();
  });

  const q = (text: string, params: unknown[] = []) =>
    schema.pool.query(text, params);

  async function createLiveUser(
    name: string,
    currentViewers: number
  ): Promise<string> {
    const { rows } = await q(
      `INSERT INTO users (username, wallet, is_live, stream_started_at, current_viewers, mux_stream_id)
       VALUES ($1, $2, true, NOW() - interval '1 hour', $3, $4)
       RETURNING id`,
      [
        name,
        `G${name.toUpperCase().padEnd(55, "X")}`,
        currentViewers,
        `mux-${name}`,
      ]
    );
    return rows[0].id;
  }

  async function openSession(userId: string): Promise<string> {
    const { rows } = await q(
      `INSERT INTO stream_sessions (user_id, mux_session_id, started_at)
       VALUES ($1, $2, NOW() - interval '1 hour') RETURNING id`,
      [userId, `mux-session-${userId}`]
    );
    return rows[0].id;
  }

  async function addViewer(
    sessionId: string,
    opts: { heartbeatAgo?: string; leftAt?: "now" | null } = {}
  ): Promise<void> {
    const heartbeat = opts.heartbeatAgo
      ? `NOW() - interval '${opts.heartbeatAgo}'`
      : "NOW()";
    await q(
      `INSERT INTO stream_viewers (stream_session_id, joined_at, heartbeat_at, left_at)
       VALUES ($1, NOW() - interval '1 hour', ${heartbeat}, ${opts.leftAt === "now" ? "NOW()" : "NULL"})`,
      [sessionId]
    );
  }

  function run(extra = {}) {
    return reconcileViewerCounts({
      executor: poolExecutor(schema.pool),
      ...extra,
    });
  }

  it("corrects a counter that drifted upward from missed leave calls", async () => {
    const user = await createLiveUser("driftup", 5);
    const streamSession = await openSession(user);
    // Only 2 viewers are actually still connected (fresh heartbeats); the
    // counter says 5, drifted from 3 leave calls that never fired.
    await addViewer(streamSession);
    await addViewer(streamSession);

    const outcome = await run();

    const { rows } = await q(
      "SELECT current_viewers FROM users WHERE id = $1",
      [user]
    );
    expect(rows[0].current_viewers).toBe(2);
    expect(outcome.status).toBe("succeeded");
    expect(outcome.metrics).toEqual(
      expect.objectContaining({
        live_streams_inspected: 1,
        counters_corrected: 1,
      })
    );
  });

  it("does not touch an already-accurate counter", async () => {
    const user = await createLiveUser("accurate", 2);
    const streamSession = await openSession(user);
    await addViewer(streamSession);
    await addViewer(streamSession);

    const outcome = await run();

    const { rows } = await q(
      "SELECT current_viewers FROM users WHERE id = $1",
      [user]
    );
    expect(rows[0].current_viewers).toBe(2);
    expect(outcome.metrics).toEqual(
      expect.objectContaining({
        counters_corrected: 0,
        counters_already_accurate: 1,
      })
    );
  });

  it("closes a viewer row whose heartbeat has gone stale and no longer counts it", async () => {
    const user = await createLiveUser("abandoned", 2);
    const streamSession = await openSession(user);
    await addViewer(streamSession); // fresh heartbeat, still watching
    await addViewer(streamSession, { heartbeatAgo: "5 minutes" }); // abandoned

    const outcome = await run({ staleWindowSeconds: 90 });

    const { rows: users } = await q(
      "SELECT current_viewers FROM users WHERE id = $1",
      [user]
    );
    expect(users[0].current_viewers).toBe(1);

    const { rows: viewers } = await q(
      "SELECT left_at FROM stream_viewers WHERE stream_session_id = $1 ORDER BY left_at NULLS FIRST",
      [streamSession]
    );
    expect(viewers[0].left_at).toBeNull(); // the fresh one, still open
    expect(viewers[1].left_at).not.toBeNull(); // the abandoned one, now closed

    expect(outcome.metrics).toEqual(
      expect.objectContaining({
        abandoned_viewers_closed: 1,
        counters_corrected: 1,
      })
    );
  });

  it("a fresh heartbeat is never treated as abandoned, even close to the staleness window", async () => {
    const user = await createLiveUser("freshedge", 1);
    const streamSession = await openSession(user);
    await addViewer(streamSession, { heartbeatAgo: "10 seconds" });

    const outcome = await run({ staleWindowSeconds: 90 });

    const { rows } = await q(
      "SELECT current_viewers FROM users WHERE id = $1",
      [user]
    );
    expect(rows[0].current_viewers).toBe(1);
    expect(outcome.metrics.abandoned_viewers_closed).toBe(0);
  });

  it("ignores a viewer already marked left, even with a stale heartbeat", async () => {
    const user = await createLiveUser("alreadyleft", 0);
    const streamSession = await openSession(user);
    await addViewer(streamSession, { heartbeatAgo: "1 hour", leftAt: "now" });

    const outcome = await run();

    const { rows } = await q(
      "SELECT current_viewers FROM users WHERE id = $1",
      [user]
    );
    expect(rows[0].current_viewers).toBe(0);
    expect(outcome.metrics.abandoned_viewers_closed).toBe(0);
    expect(outcome.metrics.counters_already_accurate).toBe(1);
  });

  it("does not inspect a stream that is not currently live", async () => {
    const { rows } = await q(
      `INSERT INTO users (username, wallet, is_live, current_viewers)
       VALUES ('offline', 'GOFFLINE0000000000000000000000000000000000000000000', false, 3)
       RETURNING id`
    );
    const user = rows[0].id;

    const outcome = await run();

    const { rows: after } = await q(
      "SELECT current_viewers FROM users WHERE id = $1",
      [user]
    );
    expect(after[0].current_viewers).toBe(3); // untouched
    expect(outcome.metrics.live_streams_inspected).toBe(0);
  });

  it("raises an alert when correction rate is abnormally high", async () => {
    for (let i = 0; i < 12; i++) {
      const user = await createLiveUser(`drift${i}`, 10);
      const streamSession = await openSession(user);
      await addViewer(streamSession);
    }

    const outcome = await run({
      alertMinCorrected: 10,
      alertCorrectionRatio: 0.3,
    });

    expect(outcome.alerts).toEqual([expect.stringContaining("abnormal drift")]);
  });

  it("does not alert for an occasional correction", async () => {
    const drifted = await createLiveUser("onedrift", 5);
    const driftedSession = await openSession(drifted);
    await addViewer(driftedSession);

    for (let i = 0; i < 9; i++) {
      const user = await createLiveUser(`ok${i}`, 1);
      const streamSession = await openSession(user);
      await addViewer(streamSession);
    }

    const outcome = await run({
      alertMinCorrected: 10,
      alertCorrectionRatio: 0.3,
    });

    expect(outcome.alerts).toEqual([]);
  });
});
