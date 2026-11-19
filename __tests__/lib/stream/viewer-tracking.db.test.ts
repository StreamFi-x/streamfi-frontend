/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";
import { mutateViewerTracking } from "@/lib/stream/viewer-tracking";
import {
  createTestSchema,
  describeWithDb,
  poolTransaction,
  type TestSchema,
} from "@/test-utils/pg-test-db";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "db/migrations/20261022090000_verified_viewer_peaks.sql"
  ),
  "utf8"
);
jest.setTimeout(30_000);

describeWithDb("authoritative viewer tracking (PostgreSQL)", () => {
  let schema: TestSchema;
  let creator: string;
  let stream: string;
  beforeEach(async () => {
    schema = await createTestSchema("verified_viewers");
    await schema.pool.query(`
      CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text,
        mux_playback_id text, is_live boolean DEFAULT true, deleted_at timestamptz,
        current_viewers int DEFAULT 999, total_views int DEFAULT 0, updated_at timestamptz);
      CREATE TABLE stream_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id), started_at timestamptz DEFAULT now(), ended_at timestamptz,
        peak_viewers int DEFAULT 0, total_unique_viewers int DEFAULT 0);
      CREATE TABLE stream_viewers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_session_id uuid REFERENCES stream_sessions(id), session_id text NOT NULL, user_id uuid,
        joined_at timestamptz DEFAULT now(), heartbeat_at timestamptz,
        left_at timestamptz, ip_address inet, country varchar(2));
    `);
    creator = (
      await schema.pool.query(
        "INSERT INTO users (username, mux_playback_id) VALUES ('creator', 'playback') RETURNING id"
      )
    ).rows[0].id;
    stream = (
      await schema.pool.query(
        "INSERT INTO stream_sessions (user_id, peak_viewers) VALUES ($1, 999) RETURNING id",
        [creator]
      )
    ).rows[0].id;
    await schema.pool.query(migration);
  });
  afterEach(async () => {
    await schema?.drop();
  });

  const run = (
    action: "join" | "heartbeat" | "leave" | "reconcile",
    sessionId = "viewer"
  ) =>
    mutateViewerTracking(
      {
        action,
        sessionId,
        playbackId: "playback",
        ip: "203.0.113.1",
        country: "GB",
      },
      poolTransaction(schema.pool)
    );
  const stats = async () =>
    (
      await schema.pool.query(
        "SELECT u.current_viewers, u.total_views, s.* FROM users u JOIN stream_sessions s ON s.user_id = u.id WHERE s.id = $1",
        [stream]
      )
    ).rows[0];

  it("replaces a drifted count without inheriting the fraudulent historical peak", async () => {
    expect(await run("join")).toMatchObject({
      currentViewers: 1,
      previousViewers: 999,
      inserted: true,
    });
    expect(await stats()).toMatchObject({
      legacy_peak_viewers: 999,
      peak_viewers: 0,
      peak_viewers_verified: true,
      total_views: 1,
    });
  });
  it("deduplicates concurrent replays and counts separate sessions exactly once", async () => {
    await Promise.all(Array.from({ length: 12 }, () => run("join")));
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => run("join", `viewer-${i}`))
    );
    expect(await stats()).toMatchObject({
      current_viewers: 9,
      total_views: 9,
      total_unique_viewers: 9,
      peak_viewers: 0,
    });
    expect(
      (await schema.pool.query("SELECT count(*)::int AS n FROM stream_viewers"))
        .rows[0].n
    ).toBe(9);
  });
  it("samples a peak only after sustained heartbeat evidence and keeps its provenance", async () => {
    await run("join");
    await schema.pool.query(
      "UPDATE stream_viewers SET joined_at = now() - interval '31 seconds'"
    );
    await run("heartbeat");
    expect(await stats()).toMatchObject({
      current_viewers: 1,
      peak_viewers: 1,
      legacy_peak_viewers: 999,
    });
    expect(
      (await schema.pool.query("SELECT * FROM stream_viewer_peak_samples"))
        .rows[0]
    ).toMatchObject({
      viewer_count: 1,
      distinct_ips: 1,
      freshness_seconds: 90,
      confirmation_seconds: 30,
    });
    await run("leave");
    expect(await stats()).toMatchObject({
      current_viewers: 0,
      peak_viewers: 1,
    });
  });
  it("excludes expired viewers, revives timed-out sessions, and refuses explicit-leave replays", async () => {
    await run("join");
    await schema.pool.query(
      "UPDATE stream_viewers SET joined_at = now() - interval '5 minutes', heartbeat_at = now() - interval '3 minutes'"
    );
    expect(await run("reconcile")).toMatchObject({
      currentViewers: 0,
      abandonedClosed: 1,
    });
    expect(await run("heartbeat")).toMatchObject({ currentViewers: 1 });
    await run("leave");
    await Promise.all([run("leave"), run("heartbeat"), run("join")]);
    expect(await stats()).toMatchObject({ current_viewers: 0, total_views: 1 });
  });
  it("does not decrement another viewer for repeated or unknown leaves", async () => {
    await run("join");
    await Promise.all([run("leave", "unknown"), run("leave", "unknown")]);
    expect((await stats()).current_viewers).toBe(1);
  });
  it("serializes reconciliation with concurrent joins and leaves", async () => {
    await run("join");
    await Promise.all([run("reconcile"), run("join", "second"), run("leave")]);
    expect(await stats()).toMatchObject({ current_viewers: 1, total_views: 2 });
  });
  it("rolls back the viewer, counters, and analytics together when sampling fails", async () => {
    await schema.pool.query("DROP TABLE stream_viewer_peak_samples");
    await expect(run("join")).rejects.toThrow();
    expect(await stats()).toMatchObject({
      current_viewers: 999,
      total_views: 0,
      peak_viewers: null,
    });
    expect(
      (await schema.pool.query("SELECT count(*)::int AS n FROM stream_viewers"))
        .rows[0].n
    ).toBe(0);
  });
  it("does not apply an old playback token to an ended stream", async () => {
    await schema.pool.query("UPDATE stream_sessions SET ended_at = now()");
    expect(await run("join")).toBeNull();
    expect((await stats()).total_views).toBe(0);
  });
  it("audits legacy duplicate counts before enforcing uniqueness and can be rerun", async () => {
    await schema.pool.query("DROP INDEX idx_stream_viewers_session_identity");
    await schema.pool.query(
      "INSERT INTO stream_viewers (stream_session_id, session_id) VALUES ($1, 'dup'), ($1, 'dup')",
      [stream]
    );
    await schema.pool.query(migration);
    await schema.pool.query(migration);
    expect(
      Number(
        (
          await schema.pool.query(
            "SELECT removed_rows FROM stream_viewer_duplicate_audit"
          )
        ).rows[0].removed_rows
      )
    ).toBe(1);
    expect(
      (await schema.pool.query("SELECT count(*)::int AS n FROM stream_viewers"))
        .rows[0].n
    ).toBe(1);
    expect(await stats()).toMatchObject({
      legacy_peak_viewers: 999,
      peak_viewers: null,
      peak_viewers_verified: false,
    });
  });
});
