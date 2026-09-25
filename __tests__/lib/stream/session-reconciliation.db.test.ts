/**
 * @jest-environment node
 *
 * #1402 orphaned stream_sessions reconciliation against real PostgreSQL.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));

import { sql } from "@vercel/postgres";
import type { MuxLiveState } from "@/lib/mux/server";
import {
  reconcileOrphanedSessions,
  StreamStateLookup,
} from "@/lib/stream/session-reconciliation";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";
import { POST as muxWebhook } from "@/app/api/webhooks/mux/route";

jest.setTimeout(30_000);

describeWithDb("reconcileOrphanedSessions (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("sessions");
    await applyAppSchema(schema.pool);
    bindVercelSql(sql as never, schema.pool);
  });

  afterEach(async () => {
    await schema.drop();
  });

  const q = (text: string, params: unknown[] = []) =>
    schema.pool.query(text, params);

  async function createUser(
    name: string,
    opts: {
      streamId?: string | null;
      isLive?: boolean;
      liveSince?: string;
    } = {}
  ): Promise<string> {
    const { rows } = await q(
      `INSERT INTO users (username, wallet, mux_stream_id, is_live, stream_started_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() - $5::interval END)
       RETURNING id`,
      [
        name,
        `G${name.toUpperCase().padEnd(55, "X")}`,
        opts.streamId === undefined ? `mux-${name}` : opts.streamId,
        opts.isLive ?? false,
        opts.liveSince ?? "1 hour",
      ]
    );
    return rows[0].id;
  }

  async function openSession(
    userId: string,
    ago: string,
    streamId: string | null
  ): Promise<string> {
    const { rows } = await q(
      `INSERT INTO stream_sessions (user_id, mux_session_id, started_at)
       VALUES ($1, $2, NOW() - $3::interval) RETURNING id`,
      [userId, streamId, ago]
    );
    return rows[0].id;
  }

  async function session(id: string) {
    const { rows } = await q(
      `SELECT id, started_at, ended_at, end_source, duration_seconds
         FROM stream_sessions WHERE id = $1`,
      [id]
    );
    return rows[0];
  }

  function muxStates(
    states: Record<string, MuxLiveState>
  ): jest.MockedFunction<StreamStateLookup> {
    return jest.fn(
      async (id: string) => states[id] ?? { state: "not_found" as const }
    );
  }

  function run(getStreamState: StreamStateLookup, extra = {}) {
    return reconcileOrphanedSessions({
      getStreamState,
      executor: poolExecutor(schema.pool),
      ...extra,
    });
  }

  it("keeps a genuinely live session open no matter how old it is", async () => {
    const user = await createUser("longstream", { isLive: true });
    const id = await openSession(user, "11 hours", "mux-longstream");

    const outcome = await run(
      muxStates({ "mux-longstream": { state: "active" } })
    );

    expect((await session(id)).ended_at).toBeNull();
    expect(outcome.metrics).toEqual(
      expect.objectContaining({ inspected: 1, active_skipped: 1, closed: 0 })
    );
    expect(outcome.status).toBe("succeeded");
  });

  it("closes an idle orphan with an estimated end at its last activity", async () => {
    const user = await createUser("orphan", { isLive: true });
    const viewer = await createUser("viewer");
    const id = await openSession(user, "3 hours", "mux-orphan");
    await q(
      `INSERT INTO chat_messages (user_id, stream_session_id, content, created_at)
       VALUES ($1, $2, 'hi', NOW() - interval '2 hours')`,
      [viewer, id]
    );
    await q(
      `INSERT INTO stream_viewers (stream_session_id, user_id, joined_at)
       VALUES ($1, $2, NOW() - interval '150 minutes')`,
      [id, viewer]
    );

    const outcome = await run(muxStates({ "mux-orphan": { state: "idle" } }));

    const row = await session(id);
    expect(row.end_source).toBe("reconciliation");
    const { rows: chat } = await q(
      "SELECT MAX(created_at) AS at FROM chat_messages WHERE stream_session_id = $1",
      [id]
    );
    expect(new Date(row.ended_at).getTime()).toBe(
      new Date(chat[0].at).getTime()
    );
    expect(row.duration_seconds).toBeGreaterThan(55 * 60);
    expect(row.duration_seconds).toBeLessThan(65 * 60);

    const { rows: viewers } = await q(
      "SELECT left_at FROM stream_viewers WHERE stream_session_id = $1",
      [id]
    );
    expect(new Date(viewers[0].left_at).getTime()).toBe(
      new Date(row.ended_at).getTime()
    );

    const { rows: users } = await q(
      "SELECT is_live, stream_started_at FROM users WHERE id = $1",
      [user]
    );
    expect(users[0]).toEqual({ is_live: false, stream_started_at: null });
    expect(outcome.metrics).toEqual(
      expect.objectContaining({
        orphans_found: 1,
        closed: 1,
        users_marked_offline: 1,
      })
    );
  });

  it("uses started_at when there is no recorded activity (zero-length estimate)", async () => {
    const user = await createUser("quiet");
    const id = await openSession(user, "5 hours", "mux-quiet");

    await run(muxStates({ "mux-quiet": { state: "disabled" } }));

    const row = await session(id);
    expect(row.ended_at).toEqual(row.started_at);
    expect(row.duration_seconds).toBe(0);
  });

  it("never estimates past Mux's 12 hour maximum or the observation time", async () => {
    const user = await createUser("marathon");
    const viewer = await createUser("fan");
    const id = await openSession(user, "20 hours", "mux-marathon");
    await q(
      `INSERT INTO chat_messages (user_id, stream_session_id, content, created_at)
       VALUES ($1, $2, 'late', NOW() - interval '1 hour')`,
      [viewer, id]
    );

    await run(muxStates({ "mux-marathon": { state: "idle" } }));

    expect((await session(id)).duration_seconds).toBe(12 * 3600);
  });

  it("closes sessions whose Mux stream no longer exists", async () => {
    const user = await createUser("deleted");
    const id = await openSession(user, "1 hour", "mux-deleted");

    await run(muxStates({}));

    expect((await session(id)).end_source).toBe("reconciliation");
  });

  it("leaves sessions open when Mux is unavailable and alerts once", async () => {
    const a = await openSession(await createUser("a1"), "1 hour", "mux-a1");
    const b = await openSession(await createUser("b1"), "1 hour", "mux-b1");
    const lookup = jest.fn(
      async (): Promise<MuxLiveState> => ({
        state: "unknown",
        httpStatus: 503,
        error: "Service Unavailable",
      })
    );

    const outcome = await run(lookup);

    expect((await session(a)).ended_at).toBeNull();
    expect((await session(b)).ended_at).toBeNull();
    expect(outcome.metrics.mux_unavailable).toBe(2);
    expect(outcome.status).toBe("partial");
    expect(outcome.alerts).toEqual([
      expect.stringMatching(/Mux state unavailable for every checked stream/),
    ]);
  });

  it("stops calling Mux after repeated rate limits and closes nothing it could not verify", async () => {
    for (let i = 0; i < 6; i++) {
      await openSession(await createUser(`rl${i}`), "1 hour", `mux-rl${i}`);
    }
    const lookup = jest.fn(
      async (): Promise<MuxLiveState> => ({
        state: "unknown",
        httpStatus: 429,
        error: "Too Many Requests",
      })
    );

    const outcome = await run(lookup, {
      muxConcurrency: 1,
      maxRateLimitResponses: 2,
    });

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(outcome.metrics.closed).toBe(0);
    expect(outcome.metrics.mux_unavailable).toBe(6);
  });

  it("does not close a session when the stream went live again after Mux was observed idle", async () => {
    const user = await createUser("restart", { isLive: false });
    const id = await openSession(user, "2 hours", "mux-restart");
    const lookup = jest.fn(async (): Promise<MuxLiveState> => {
      // The active webhook lands while the job is still working with its
      // (now stale) idle observation.
      await new Promise(resolve => setTimeout(resolve, 20));
      await q(
        `UPDATE users SET is_live = TRUE, stream_started_at = NOW() + interval '1 second'
          WHERE id = $1`,
        [user]
      );
      return { state: "idle" };
    });

    const outcome = await run(lookup);

    expect((await session(id)).ended_at).toBeNull();
    expect(outcome.metrics.race_skipped).toBe(1);
    const { rows } = await q("SELECT is_live FROM users WHERE id = $1", [user]);
    expect(rows[0].is_live).toBe(true);
  });

  it("is idempotent across repeated runs", async () => {
    const user = await createUser("repeat");
    const id = await openSession(user, "2 hours", "mux-repeat");
    const lookup = muxStates({ "mux-repeat": { state: "idle" } });

    await run(lookup);
    const first = await session(id);
    const second = await run(lookup);

    expect(await session(id)).toEqual(first);
    expect(second.metrics.inspected).toBe(0);
    expect(second.metrics.closed).toBe(0);
  });

  it("closes each orphan exactly once when two runs race", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        await openSession(
          await createUser(`race${i}`),
          "1 hour",
          `mux-race${i}`
        )
      );
    }
    // Both runs take their candidate snapshot before either closes anything.
    const arrived = new Set<string>();
    let release: () => void = () => undefined;
    const bothSnapshotted = new Promise<void>(resolve => {
      release = resolve;
    });
    const lookupFor = (runId: string) => async (): Promise<MuxLiveState> => {
      arrived.add(runId);
      if (arrived.size === 2) {
        release();
      }
      await bothSnapshotted;
      return { state: "idle" };
    };

    const [a, b] = await Promise.all([
      run(lookupFor("a")),
      run(lookupFor("b")),
    ]);

    expect(a.metrics.closed + b.metrics.closed).toBe(5);
    expect(a.metrics.race_skipped + b.metrics.race_skipped).toBe(5);
    const { rows } = await q(
      "SELECT COUNT(*)::int AS n FROM stream_sessions WHERE ended_at IS NULL"
    );
    expect(rows[0].n).toBe(0);
  });

  it("ignores sessions younger than the minimum age", async () => {
    await openSession(await createUser("fresh"), "2 minutes", "mux-fresh");
    const lookup = muxStates({});

    const outcome = await run(lookup);

    expect(outcome.metrics.inspected).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("closes older duplicate open sessions of a live user and keeps the newest", async () => {
    const user = await createUser("dupe", { isLive: true });
    const older = await openSession(user, "3 hours", "mux-dupe");
    const newer = await openSession(user, "1 hour", "mux-dupe");

    const outcome = await run(muxStates({ "mux-dupe": { state: "active" } }));

    const oldRow = await session(older);
    const newRow = await session(newer);
    expect(newRow.ended_at).toBeNull();
    expect(new Date(oldRow.ended_at).getTime()).toBe(
      new Date(newRow.started_at).getTime()
    );
    expect(outcome.metrics.duplicates_closed).toBe(1);
  });

  it("skips live users without any stream id but closes offline ones", async () => {
    const liveUser = await createUser("nolink", {
      streamId: null,
      isLive: true,
    });
    const offlineUser = await createUser("nolink2", { streamId: null });
    const kept = await openSession(liveUser, "1 hour", null);
    const closed = await openSession(offlineUser, "1 hour", null);

    const outcome = await run(muxStates({}));

    expect((await session(kept)).ended_at).toBeNull();
    expect((await session(closed)).end_source).toBe("reconciliation");
    expect(outcome.metrics.unverifiable_skipped).toBe(1);
  });

  it("raises one aggregated alert for an abnormal correction rate", async () => {
    for (let i = 0; i < 6; i++) {
      await openSession(await createUser(`bulk${i}`), "1 hour", `mux-bulk${i}`);
    }

    const outcome = await run(muxStates({}));

    expect(outcome.metrics.closed).toBe(6);
    expect(outcome.alerts).toEqual([
      expect.stringMatching(/abnormal correction rate: closed 6 of 6/),
    ]);
  });

  it("does not alert for an occasional correction", async () => {
    const states: Record<string, MuxLiveState> = {};
    for (let i = 0; i < 9; i++) {
      await openSession(
        await createUser(`ok${i}`, { isLive: true }),
        "1 hour",
        `mux-ok${i}`
      );
      states[`mux-ok${i}`] = { state: "active" };
    }
    await openSession(await createUser("lost"), "1 hour", "mux-lost");

    const outcome = await run(muxStates(states));

    expect(outcome.metrics.closed).toBe(1);
    expect(outcome.alerts).toEqual([]);
  });

  describe("active-session deduplication", () => {
    async function webhook(type: string, streamId: string) {
      const request = new Request("http://localhost/api/webhooks/mux", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, data: { id: streamId } }),
      });
      return muxWebhook(request as never);
    }

    it("a reconciled orphan no longer blocks the next broadcast's session", async () => {
      const user = await createUser("blocked", { isLive: true });
      const stale = await openSession(user, "3 hours", "mux-blocked");

      await run(muxStates({ "mux-blocked": { state: "idle" } }));
      await webhook("video.live_stream.active", "mux-blocked");

      const { rows: after } = await q(
        `SELECT id, ended_at, end_source FROM stream_sessions
          WHERE user_id = $1 ORDER BY started_at`,
        [user]
      );
      expect(after).toHaveLength(2);
      expect(after[0]).toEqual(
        expect.objectContaining({ id: stale, end_source: "reconciliation" })
      );
      expect(after[1].ended_at).toBeNull();
      expect(after[1].end_source).toBeNull();
    });

    it("keeps reconciled sessions queryable as history", async () => {
      const user = await createUser("history");
      const id = await openSession(user, "2 hours", "mux-history");

      await run(muxStates({}));

      const { rows } = await q(
        `SELECT COUNT(*)::int AS streams, SUM(duration_seconds)::int AS seconds
           FROM stream_sessions WHERE user_id = $1 AND ended_at IS NOT NULL`,
        [user]
      );
      expect(rows[0]).toEqual({ streams: 1, seconds: 0 });
      expect((await session(id)).id).toBe(id);
    });
  });
});
