/**
 * @jest-environment node
 *
 * Issue #1866: Production-grade stream recording session attribution tests.
 * Validates passthrough parsing, time-window correlation, rapid restart guards,
 * out-of-order webhook resilience, and distributed idempotency.
 */

import { fakePostgres as db } from "@/testing/fake-postgres";
import {
  resolveRecordingSession,
  extractMetadataFromPassthrough,
  parseAssetCreatedAt,
  DEFAULT_ATTRIBUTION_WINDOW_MS,
} from "@/lib/mux/recording-attribution";
import { upsertRecordingFromAsset } from "@/lib/mux/recordings";

const STREAM_ID = "mux-stream-1866";
const PLAYBACK_ID = "playback-1866";
const USER_ID = "user-1866";

describe("extractMetadataFromPassthrough", () => {
  it("extracts UUID directly", () => {
    const uuid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    expect(extractMetadataFromPassthrough(uuid)).toEqual({
      sessionId: uuid,
    });
  });

  it("extracts prefixed session IDs", () => {
    expect(extractMetadataFromPassthrough("streamfi:session:sess-123")).toEqual(
      {
        sessionId: "sess-123",
      }
    );
    expect(extractMetadataFromPassthrough("session:sess-456")).toEqual({
      sessionId: "sess-456",
    });
  });

  it("extracts from JSON objects with various key conventions", () => {
    expect(
      extractMetadataFromPassthrough('{"sessionId": "sess-json-1"}')
    ).toEqual({ sessionId: "sess-json-1" });

    expect(
      extractMetadataFromPassthrough('{"streamSessionId": "sess-json-2"}')
    ).toEqual({ sessionId: "sess-json-2" });

    expect(
      extractMetadataFromPassthrough('{"session_id": "sess-json-3"}')
    ).toEqual({ sessionId: "sess-json-3" });

    expect(
      extractMetadataFromPassthrough(
        '{"sessionId": "sess-full", "playbackId": "pb-full", "userId": "user-full"}'
      )
    ).toEqual({
      sessionId: "sess-full",
      playbackId: "pb-full",
      userId: "user-full",
    });
  });

  it("ignores orphan-sweep prefix tags to prevent false session matching", () => {
    expect(
      extractMetadataFromPassthrough("streamfi:create:orphan-uuid-123")
    ).toBeNull();
  });

  it("handles empty or invalid inputs gracefully", () => {
    expect(extractMetadataFromPassthrough(null)).toBeNull();
    expect(extractMetadataFromPassthrough(undefined)).toBeNull();
    expect(extractMetadataFromPassthrough("")).toBeNull();
    expect(extractMetadataFromPassthrough("   ")).toBeNull();
    expect(extractMetadataFromPassthrough(123)).toBeNull();
    expect(extractMetadataFromPassthrough("{ malformed json")).toBeNull();
  });
});

describe("parseAssetCreatedAt", () => {
  it("parses Unix epoch seconds", () => {
    const ts = 1700000000;
    const d = parseAssetCreatedAt(ts);
    expect(d.getTime()).toBe(ts * 1000);
  });

  it("parses Unix epoch milliseconds", () => {
    const ms = 1700000000000;
    const d = parseAssetCreatedAt(ms);
    expect(d.getTime()).toBe(ms);
  });

  it("parses ISO date string", () => {
    const iso = "2026-11-22T12:00:00.000Z";
    const d = parseAssetCreatedAt(iso);
    expect(d.toISOString()).toBe(iso);
  });

  it("falls back to current time for invalid input", () => {
    const now = Date.now();
    const d = parseAssetCreatedAt("invalid-date-xyz");
    expect(Math.abs(d.getTime() - now)).toBeLessThan(5000);
  });
});

describe("resolveRecordingSession attribution logic", () => {
  let txClient: Awaited<ReturnType<typeof db.connect>>;

  beforeEach(async () => {
    db.reset();
    db.addUser({
      id: USER_ID,
      mux_stream_id: STREAM_ID,
      mux_playback_id: PLAYBACK_ID,
      creator: { title: "Pro Gaming", streamTitle: "Speedrun Any%" },
    });
    txClient = await db.connect();
  });

  afterEach(() => {
    txClient.release();
  });

  describe("Requirement: Passthrough Correlation", () => {
    it("correlates directly when passthrough session ID exists in DB", async () => {
      const session = db.addSession({
        id: "sess-exact-passthrough",
        user_id: USER_ID,
        title: "Passthrough Stream",
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-pt-1",
        liveStreamId: STREAM_ID,
        passthrough: JSON.stringify({ sessionId: session.id }),
      });

      expect(result.streamSessionId).toBe(session.id);
      expect(result.userId).toBe(USER_ID);
      expect(result.method).toBe("passthrough_session_id");
    });

    it("falls back to time-window correlation when passthrough session ID is not in DB", async () => {
      const baseTime = new Date("2026-11-22T12:00:00Z");
      const session = db.addSession({
        id: "sess-fallback-db",
        user_id: USER_ID,
        started_at: new Date(baseTime.getTime() - 3600_000),
        ended_at: new Date(baseTime.getTime() - 30_000),
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-unknown-pt",
        liveStreamId: STREAM_ID,
        passthrough: "non-existent-session-id",
        assetCreatedAt: baseTime,
      });

      expect(result.streamSessionId).toBe(session.id);
      expect(result.userId).toBe(USER_ID);
      expect(result.method).toBe("time_window");
    });
  });

  describe("Requirement: Fallback Time Window Correlation & Stale Session Rejection", () => {
    it("correlates correctly when ended_at is within the bounded time window", async () => {
      const assetTime = new Date("2026-11-22T15:00:00Z");

      // Session ended 2 minutes before asset creation
      const session = db.addSession({
        id: "sess-recent",
        user_id: USER_ID,
        started_at: new Date("2026-11-22T14:00:00Z"),
        ended_at: new Date("2026-11-22T14:58:00Z"),
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-recent",
        liveStreamId: STREAM_ID,
        assetCreatedAt: assetTime,
        windowThresholdMs: 15 * 60 * 1000,
      });

      expect(result.streamSessionId).toBe(session.id);
      expect(result.method).toBe("time_window");
    });

    it("rejects stale sessions that ended outside the bounded time window", async () => {
      const assetTime = new Date("2026-11-22T18:00:00Z");

      // Stale session that ended 3 hours ago
      db.addSession({
        id: "sess-stale",
        user_id: USER_ID,
        started_at: new Date("2026-11-22T14:00:00Z"),
        ended_at: new Date("2026-11-22T15:00:00Z"),
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-stale",
        liveStreamId: STREAM_ID,
        assetCreatedAt: assetTime,
        windowThresholdMs: 15 * 60 * 1000, // 15 min window
      });

      expect(result.streamSessionId).toBeNull();
      expect(result.method).toBe("none");
      expect(result.userId).toBe(USER_ID);
    });

    it("selects the closest ended session when multiple ended sessions qualify", async () => {
      const assetTime = new Date("2026-11-22T16:00:00Z");

      // Session A ended 10 minutes ago
      db.addSession({
        id: "sess-further",
        user_id: USER_ID,
        started_at: new Date("2026-11-22T15:00:00Z"),
        ended_at: new Date("2026-11-22T15:50:00Z"),
      });

      // Session B ended 1 minute ago
      const closerSession = db.addSession({
        id: "sess-closer",
        user_id: USER_ID,
        started_at: new Date("2026-11-22T15:52:00Z"),
        ended_at: new Date("2026-11-22T15:59:00Z"),
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-multi",
        liveStreamId: STREAM_ID,
        assetCreatedAt: assetTime,
      });

      expect(result.streamSessionId).toBe(closerSession.id);
      expect(result.method).toBe("time_window");
    });
  });

  describe("Requirement: Rapid Stream Restart Scenario", () => {
    it("does not misattribute asset to a newly started active session", async () => {
      const stream1Ended = new Date("2026-11-22T14:30:00Z");
      const asset1Created = new Date("2026-11-22T14:30:10Z");
      const stream2Started = new Date("2026-11-22T14:31:00Z");

      // Session 1: Finished broadcast
      const session1 = db.addSession({
        id: "sess-1-ended",
        user_id: USER_ID,
        mux_session_id: STREAM_ID,
        started_at: new Date("2026-11-22T14:00:00Z"),
        ended_at: stream1Ended,
      });

      // Session 2: Creator immediately restarted OBS, still active
      db.addSession({
        id: "sess-2-new-active",
        user_id: USER_ID,
        mux_session_id: STREAM_ID,
        started_at: stream2Started,
        ended_at: null,
      });

      // Webhook for Asset 1 arrives after Session 2 has started
      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-from-session-1",
        liveStreamId: STREAM_ID,
        assetCreatedAt: asset1Created,
      });

      // Must be attributed to Session 1, NOT Session 2!
      expect(result.streamSessionId).toBe(session1.id);
      expect(result.method).toBe("time_window");
    });

    it("does not misattribute asset to a new session that already ended rapidly", async () => {
      const stream1Ended = new Date("2026-11-22T14:30:00Z");
      const asset1Created = new Date("2026-11-22T14:30:05Z");

      // Session 1 (30 min broadcast)
      const session1 = db.addSession({
        id: "sess-1-main",
        user_id: USER_ID,
        started_at: new Date("2026-11-22T14:00:00Z"),
        ended_at: stream1Ended,
      });

      // Session 2 (10 second test stream that started AFTER asset 1 was created)
      db.addSession({
        id: "sess-2-quick-test",
        user_id: USER_ID,
        started_at: new Date("2026-11-22T14:31:00Z"),
        ended_at: new Date("2026-11-22T14:31:10Z"),
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-stream-1",
        liveStreamId: STREAM_ID,
        assetCreatedAt: asset1Created,
      });

      // In the old naive query (ORDER BY ended_at DESC LIMIT 1), sess-2 would have won.
      // With our fix, Session 2 is rejected because it started after asset creation!
      expect(result.streamSessionId).toBe(session1.id);
      expect(result.method).toBe("time_window");
    });
  });

  describe("Requirement: Out-of-order Webhook Delivery", () => {
    it("attaches to the active session when asset ready arrives before live stream idle", async () => {
      const streamStarted = new Date("2026-11-22T10:00:00Z");
      const assetCreated = new Date("2026-11-22T10:25:00Z");

      // Active stream session (idle webhook not received yet)
      const activeSession = db.addSession({
        id: "sess-active-out-of-order",
        user_id: USER_ID,
        mux_session_id: STREAM_ID,
        started_at: streamStarted,
        ended_at: null,
      });

      // Old ended session from yesterday
      db.addSession({
        id: "sess-yesterday",
        user_id: USER_ID,
        started_at: new Date("2026-11-21T10:00:00Z"),
        ended_at: new Date("2026-11-21T11:00:00Z"),
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-ooo-1",
        liveStreamId: STREAM_ID,
        assetCreatedAt: assetCreated,
      });

      expect(result.streamSessionId).toBe(activeSession.id);
      expect(result.method).toBe("active_session");
    });
  });

  describe("Requirement: Idempotency and Existing Recordings", () => {
    it("preserves already attributed stream_session_id when re-processed", async () => {
      // Pre-seed an existing recording in the database
      db.state.stream_recordings.set("asset-idempotent-1", {
        user_id: USER_ID,
        stream_session_id: "sess-original-123",
        mux_asset_id: "asset-idempotent-1",
        playback_id: "pb-idempotent",
        title: "Original Title",
        duration: 100,
        status: "ready",
        needs_review: false,
      });

      const result = await resolveRecordingSession(txClient, {
        assetId: "asset-idempotent-1",
        liveStreamId: STREAM_ID,
        passthrough: "different-session-id",
      });

      expect(result.streamSessionId).toBe("sess-original-123");
      expect(result.method).toBe("existing_recording");
    });

    it("upsertRecordingFromAsset does not overwrite an existing session ID on duplicate delivery", async () => {
      const firstInserted = await upsertRecordingFromAsset(
        {
          userId: USER_ID,
          streamSessionId: "session-initial",
          assetId: "asset-dup-test",
          playbackId: "pb-dup",
          title: "My Stream",
          duration: 300,
        },
        txClient
      );
      expect(firstInserted).toBe(true);
      expect(
        db.state.stream_recordings.get("asset-dup-test")?.stream_session_id
      ).toBe("session-initial");

      // Redelivery with a different session ID (or null)
      const secondInserted = await upsertRecordingFromAsset(
        {
          userId: USER_ID,
          streamSessionId: "session-accidentally-changed",
          assetId: "asset-dup-test",
          playbackId: "pb-dup-updated",
          title: "Updated Title",
          duration: 310,
        },
        txClient
      );
      expect(secondInserted).toBe(false);

      // The original session ID must be preserved!
      const recording = db.state.stream_recordings.get("asset-dup-test");
      expect(recording?.stream_session_id).toBe("session-initial");
      expect(recording?.duration).toBe(310);
      expect(recording?.playback_id).toBe("pb-dup-updated");
    });
  });
});
