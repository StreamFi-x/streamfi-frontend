/**
 * @jest-environment node
 *
 * #1447 report-brigading resistance against real PostgreSQL.
 */
jest.mock("@vercel/postgres", () => ({
  sql: Object.assign(jest.fn(), { query: jest.fn() }),
}));

import { sql } from "@vercel/postgres";
import { assessReportAbuse } from "@/lib/stream/report-abuse-detection";
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  poolExecutor,
  TestSchema,
} from "@/test-utils/pg-test-db";
import { bindVercelSql } from "@/test-utils/vercel-sql-adapter";

jest.setTimeout(30_000);

describeWithDb("assessReportAbuse (PostgreSQL)", () => {
  let schema: TestSchema;

  beforeEach(async () => {
    schema = await createTestSchema("reportabuse");
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
    opts: { createdAgo?: string } = {}
  ): Promise<string> {
    const { rows } = await q(
      `INSERT INTO users (username, wallet, created_at)
       VALUES ($1, $2, NOW() - $3::interval)
       RETURNING id`,
      [
        name,
        `G${name.toUpperCase().padEnd(55, "X")}`,
        opts.createdAgo ?? "2 years",
      ]
    );
    return rows[0].id;
  }

  async function insertReport(opts: {
    streamId: string;
    reason: string;
    reporterUserId?: string | null;
    priority?: "normal" | "expedited";
    agoMinutes?: number;
  }): Promise<string> {
    const { rows } = await q(
      `INSERT INTO stream_reports
         (reporter_id, reporter_user_id, is_anonymous, priority, stream_id, streamer, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, 'streamer', $6, NOW() - ($7 || ' minutes')::interval)
       RETURNING id`,
      [
        opts.reporterUserId ?? "anonymous",
        opts.reporterUserId ?? null,
        !opts.reporterUserId,
        opts.priority ?? "normal",
        opts.streamId,
        opts.reason,
        opts.agoMinutes ?? 0,
      ]
    );
    return rows[0].id;
  }

  function run(overrides: Parameters<typeof assessReportAbuse>[0]) {
    return assessReportAbuse({
      executor: poolExecutor(schema.pool),
      ...overrides,
    });
  }

  it("does not flag a single ordinary report with no history", async () => {
    const result = await run({
      streamId: "stream-1",
      reason: "harassment",
      reporterUserId: null,
    });

    expect(result.priority).toBe("normal");
    expect(result.flags).toEqual([]);
  });

  it("flags a volume spike when a stream's recent report rate far exceeds its own baseline", async () => {
    const streamId = "stream-spiked";
    // A quiet baseline: 2 reports over the last week.
    await insertReport({
      streamId,
      reason: "harassment",
      agoMinutes: 60 * 24 * 3,
    });
    await insertReport({
      streamId,
      reason: "harassment",
      agoMinutes: 60 * 24 * 5,
    });
    // Then a burst: 5 more in the last few minutes (this call is the 6th).
    for (let i = 0; i < 5; i++) {
      await insertReport({ streamId, reason: "harassment", agoMinutes: i });
    }

    const result = await run({
      streamId,
      reason: "harassment",
      reporterUserId: null,
      spikeMinRecentReports: 5,
    });

    expect(result.priority).toBe("expedited");
    expect(result.flags.map(f => f.signal)).toContain("volume_spike");
  });

  it("does not flag a stream with a consistently high but stable report rate", async () => {
    const streamId = "stream-busy";
    // Baseline and recent rate are proportionally the same: not a spike,
    // just a stream that always gets reported at this rate (e.g. a
    // controversial but legitimate creator).
    for (let i = 0; i < 20; i++) {
      await insertReport({
        streamId,
        reason: "misinformation",
        agoMinutes: 60 * 24 * (i + 1), // spread evenly across the baseline window
      });
    }
    for (let i = 0; i < 3; i++) {
      await insertReport({ streamId, reason: "misinformation", agoMinutes: i });
    }

    const result = await run({
      streamId,
      reason: "misinformation",
      reporterUserId: null,
      spikeMinRecentReports: 5,
    });

    expect(result.flags.map(f => f.signal)).not.toContain("volume_spike");
  });

  it("flags a newly created account", async () => {
    const reporter = await createUser("newbie", { createdAgo: "2 hours" });

    const result = await run({
      streamId: "stream-x",
      reason: "harassment",
      reporterUserId: reporter,
      newAccountWindowHours: 24,
    });

    expect(result.flags.map(f => f.signal)).toContain("new_account");
  });

  it("does not flag an established account with real platform activity", async () => {
    const reporter = await createUser("regular", { createdAgo: "1 year" });
    const streamer = await createUser("someoneelse");
    await q(
      `INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2)`,
      [reporter, streamer]
    );

    const result = await run({
      streamId: "stream-x",
      reason: "harassment",
      reporterUserId: reporter,
    });

    expect(result.flags.map(f => f.signal)).not.toContain("new_account");
    expect(result.flags.map(f => f.signal)).not.toContain(
      "no_platform_activity"
    );
  });

  it("flags no_platform_activity for an account with no follows, chat, or viewing history", async () => {
    const reporter = await createUser("ghost", { createdAgo: "1 year" });

    const result = await run({
      streamId: "stream-x",
      reason: "harassment",
      reporterUserId: reporter,
    });

    expect(result.flags.map(f => f.signal)).toContain("no_platform_activity");
  });

  it("flags coordinated accounts sharing a mutual follow within the reporting window", async () => {
    const reporterA = await createUser("brigadeA");
    const reporterB = await createUser("brigadeB");
    await q(
      `INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2)`,
      [reporterA, reporterB]
    );
    await insertReport({
      streamId: "stream-brigaded",
      reason: "harassment",
      reporterUserId: reporterB,
      agoMinutes: 2,
    });

    const result = await run({
      streamId: "stream-brigaded",
      reason: "harassment",
      reporterUserId: reporterA,
    });

    expect(result.flags.map(f => f.signal)).toContain("coordinated_accounts");
    expect(result.priority).toBe("expedited");
  });

  it("flags coordinated accounts sharing recent chat co-presence within the reporting window", async () => {
    const reporterA = await createUser("chatterA");
    const reporterB = await createUser("chatterB");
    const streamer = await createUser("targetstreamer");
    const { rows: sessionRows } = await q(
      `INSERT INTO stream_sessions (user_id, mux_session_id, started_at)
       VALUES ($1, 'mux-target', NOW() - interval '2 hours') RETURNING id`,
      [streamer]
    );
    const sessionId = sessionRows[0].id;
    await q(
      `INSERT INTO chat_messages (user_id, stream_session_id, content, created_at)
       VALUES ($1, $2, 'hi', NOW() - interval '10 seconds')`,
      [reporterA, sessionId]
    );
    await q(
      `INSERT INTO chat_messages (user_id, stream_session_id, content, created_at)
       VALUES ($1, $2, 'hi back', NOW())`,
      [reporterB, sessionId]
    );
    await insertReport({
      streamId: "stream-chat-brigaded",
      reason: "harassment",
      reporterUserId: reporterB,
      agoMinutes: 1,
    });

    const result = await run({
      streamId: "stream-chat-brigaded",
      reason: "harassment",
      reporterUserId: reporterA,
    });

    expect(result.flags.map(f => f.signal)).toContain("coordinated_accounts");
  });

  it("excludes anonymous reports from coordination checks entirely", async () => {
    const result = await run({
      streamId: "stream-anon",
      reason: "harassment",
      reporterUserId: null,
    });

    expect(result.flags.map(f => f.signal)).not.toContain("new_account");
    expect(result.flags.map(f => f.signal)).not.toContain(
      "no_platform_activity"
    );
    expect(result.flags.map(f => f.signal)).not.toContain(
      "coordinated_accounts"
    );
  });

  it("tags a duplicate-of-recent report but does not double-escalate an already-escalated cluster", async () => {
    const streamId = "stream-dup";
    await insertReport({
      streamId,
      reason: "harassment",
      priority: "expedited",
      agoMinutes: 2,
    });

    const result = await run({
      streamId,
      reason: "harassment",
      reporterUserId: null,
    });

    expect(result.flags.map(f => f.signal)).toContain("duplicate_of_recent");
    // No new escalating signal here (no spike threshold crossed, no
    // coordination), and the cluster is already escalated, so this stays
    // normal rather than re-triggering.
    expect(result.priority).toBe("normal");
  });

  it("a duplicate report can still escalate on its own merits (e.g. it is the one crossing the spike threshold)", async () => {
    const streamId = "stream-dup-spike";
    // assessReportAbuse only reads existing rows (the route inserts
    // separately, after assessing), so the report actually "being assessed"
    // is represented by inserting it here too: 5 prior identical-reason
    // reports means the assessment call sees recentCount = 5, crossing the
    // threshold, while also finding 5 prior duplicates of the same reason.
    for (let i = 0; i < 5; i++) {
      await insertReport({ streamId, reason: "harassment", agoMinutes: i });
    }

    const result = await run({
      streamId,
      reason: "harassment",
      reporterUserId: null,
      spikeMinRecentReports: 5,
    });

    expect(result.flags.map(f => f.signal)).toEqual(
      expect.arrayContaining(["duplicate_of_recent", "volume_spike"])
    );
    expect(result.priority).toBe("expedited");
  });

  it("the legitimate-high-volume-genuine-incident case: many distinct, established, unconnected accounts reporting the same real incident all still surface promptly without looking like coordination", async () => {
    const streamId = "stream-real-incident";
    const reporters: string[] = [];
    for (let i = 0; i < 8; i++) {
      reporters.push(await createUser(`genuine${i}`, { createdAgo: "1 year" }));
    }
    // Each has real, unrelated platform activity (distinct followees), and
    // none follow each other or share chat presence.
    for (const reporter of reporters) {
      const followee = await createUser(`followee-of-${reporter}`);
      await q(
        `INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2)`,
        [reporter, followee]
      );
    }

    for (let i = 0; i < reporters.length - 1; i++) {
      await insertReport({
        streamId,
        reason: "inappropriate-content",
        reporterUserId: reporters[i],
        agoMinutes: i,
      });
    }

    // The last of the 8 genuine reporters files the (8th) report.
    const result = await run({
      streamId,
      reason: "inappropriate-content",
      reporterUserId: reporters[reporters.length - 1],
      spikeMinRecentReports: 5,
    });

    // It legitimately trips the volume-spike signal (8 real reports about
    // one real incident in a short window IS unusual for this stream) and
    // is correctly routed to expedited human review...
    expect(result.flags.map(f => f.signal)).toContain("volume_spike");
    expect(result.priority).toBe("expedited");
    // ...but crucially, none of these individually-unremarkable, mutually
    // unconnected, established accounts are flagged as coordinated or
    // low-legitimacy — the graduated response here is "a human should look
    // at this promptly," never "these accounts look like a brigade."
    expect(result.flags.map(f => f.signal)).not.toContain(
      "coordinated_accounts"
    );
    expect(result.flags.map(f => f.signal)).not.toContain("new_account");
    expect(result.flags.map(f => f.signal)).not.toContain(
      "no_platform_activity"
    );
  });

  it("the brigade case: coordinated, low-legitimacy accounts reporting together are flagged distinctly from the genuine-incident case", async () => {
    const streamId = "stream-brigade-attack";
    const sockpuppets: string[] = [];
    for (let i = 0; i < 6; i++) {
      sockpuppets.push(
        await createUser(`sock${i}`, { createdAgo: "30 minutes" })
      );
    }
    // The sockpuppets follow each other, forming a tight cluster.
    for (let i = 0; i < sockpuppets.length; i++) {
      await q(
        `INSERT INTO user_follows (follower_id, followee_id) VALUES ($1, $2)`,
        [sockpuppets[i], sockpuppets[(i + 1) % sockpuppets.length]]
      );
    }
    for (let i = 0; i < sockpuppets.length - 1; i++) {
      await insertReport({
        streamId,
        reason: "harassment",
        reporterUserId: sockpuppets[i],
        agoMinutes: i,
      });
    }

    const result = await run({
      streamId,
      reason: "harassment",
      reporterUserId: sockpuppets[sockpuppets.length - 1],
      spikeMinRecentReports: 5,
    });

    expect(result.priority).toBe("expedited");
    expect(result.flags.map(f => f.signal)).toEqual(
      expect.arrayContaining([
        "volume_spike",
        "new_account",
        "coordinated_accounts",
      ])
    );
  });
});
