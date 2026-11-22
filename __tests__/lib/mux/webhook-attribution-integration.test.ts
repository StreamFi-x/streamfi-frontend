/**
 * @jest-environment node
 *
 * Integration tests for Issue #1866:
 * Verifies end-to-end Mux webhook ingestion routes with signature verification,
 * exactly-once event logging, session attribution, and idempotency.
 */

jest.mock(
  "@vercel/postgres",
  () => jest.requireActual("@/testing/fake-postgres").vercelPostgresMock
);
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false,
}));

import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { fakePostgres as db } from "@/testing/fake-postgres";
import { POST as mainWebhook } from "@/app/api/webhooks/mux/route";
import { POST as assetWebhook } from "@/app/api/routes-f/webhooks-mux-asset/route";
import {
  MemoryKvStore,
  setSecurityKvStoreForTesting,
} from "@/lib/security/kv-store";

const SECRET = "TEST-mux-webhook-secret-1866";
const STREAM_ID = "mux-stream-e2e";
const PLAYBACK_ID = "pb-e2e";
const USER_ID = "user-e2e";
const ORIGINAL_ENV = process.env;

let eventSeq = 0;
function createEvent(type: string, data: Record<string, unknown>, id?: string) {
  return {
    id: id ?? `evt-attr-${++eventSeq}`,
    type,
    created_at: new Date().toISOString(),
    data,
  };
}

function signPayload(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

function deliver(
  handler: (req: NextRequest) => Promise<Response>,
  evt: object
) {
  const body = JSON.stringify(evt);
  return handler(
    new NextRequest("http://localhost/api/webhooks/mux", {
      method: "POST",
      headers: { "mux-signature": signPayload(body) },
      body,
    })
  );
}

beforeEach(() => {
  db.reset();
  setSecurityKvStoreForTesting(new MemoryKvStore());
  process.env = { ...ORIGINAL_ENV, MUX_WEBHOOK_SECRET: SECRET };
  db.addUser({
    id: USER_ID,
    mux_stream_id: STREAM_ID,
    mux_playback_id: PLAYBACK_ID,
    creator: { title: "Championship Tournament", streamTitle: "Final Match" },
  });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  setSecurityKvStoreForTesting(null);
  jest.restoreAllMocks();
});

describe("Mux Webhook Session Attribution E2E Integration", () => {
  it("attributes recording to stream session when passthrough metadata carries the session ID", async () => {
    const session = db.addSession({
      id: "sess-passthrough-e2e",
      user_id: USER_ID,
      title: "Championship Stream",
    });

    const evt = createEvent("video.asset.ready", {
      id: "asset-passthrough-1",
      playback_ids: [{ id: "asset-pb-1" }],
      duration: 3600,
      live_stream_id: STREAM_ID,
      passthrough: JSON.stringify({ sessionId: session.id }),
    });

    const res = await deliver(mainWebhook, evt);
    expect(res.status).toBe(200);

    const recording = db.state.stream_recordings.get("asset-passthrough-1");
    expect(recording).toBeDefined();
    expect(recording?.stream_session_id).toBe(session.id);
    expect(recording?.status).toBe("ready");
    expect(recording?.duration).toBe(3600);
  });

  it("attributes recording via fallback time window when session ended recently", async () => {
    const now = Date.now();
    const session = db.addSession({
      id: "sess-window-e2e",
      user_id: USER_ID,
      started_at: new Date(now - 1800_000), // 30 mins ago
      ended_at: new Date(now - 60_000), // 1 min ago
    });

    const evt = createEvent("video.asset.ready", {
      id: "asset-window-1",
      playback_ids: [{ id: "asset-pb-2" }],
      duration: 1740,
      live_stream_id: STREAM_ID,
      created_at: Math.floor((now - 55_000) / 1000), // created ~55s ago
    });

    const res = await deliver(assetWebhook, evt);
    expect(res.status).toBe(200);

    const recording = db.state.stream_recordings.get("asset-window-1");
    expect(recording).toBeDefined();
    expect(recording?.stream_session_id).toBe(session.id);
  });

  it("leaves stream_session_id as null when session is stale (outside time window)", async () => {
    const now = Date.now();
    // Stale session that ended 2 hours ago
    db.addSession({
      id: "sess-stale-e2e",
      user_id: USER_ID,
      started_at: new Date(now - 3 * 3600_000),
      ended_at: new Date(now - 2 * 3600_000),
    });

    const evt = createEvent("video.asset.ready", {
      id: "asset-stale-1",
      playback_ids: [{ id: "asset-pb-stale" }],
      duration: 300,
      live_stream_id: STREAM_ID,
      created_at: Math.floor(now / 1000), // Asset created just now
    });

    const res = await deliver(mainWebhook, evt);
    expect(res.status).toBe(200);

    const recording = db.state.stream_recordings.get("asset-stale-1");
    expect(recording).toBeDefined();
    expect(recording?.stream_session_id).toBeNull();
  });

  it("handles rapid stream restart without misattributing to the new session", async () => {
    const stream1Ended = new Date("2026-11-22T10:30:00Z");
    const asset1Created = Math.floor(
      new Date("2026-11-22T10:30:05Z").getTime() / 1000
    );
    const stream2Started = new Date("2026-11-22T10:30:45Z");

    // Session 1: Ended normally
    const session1 = db.addSession({
      id: "session-1-original",
      user_id: USER_ID,
      mux_session_id: STREAM_ID,
      started_at: new Date("2026-11-22T10:00:00Z"),
      ended_at: stream1Ended,
    });

    // Session 2: Creator immediately restarted OBS (active or just started)
    db.addSession({
      id: "session-2-restarted",
      user_id: USER_ID,
      mux_session_id: STREAM_ID,
      started_at: stream2Started,
      ended_at: null,
    });

    const evt = createEvent("video.asset.ready", {
      id: "asset-rapid-restart",
      playback_ids: [{ id: "pb-asset-1" }],
      duration: 1800,
      live_stream_id: STREAM_ID,
      created_at: asset1Created,
    });

    const res = await deliver(mainWebhook, evt);
    expect(res.status).toBe(200);

    const recording = db.state.stream_recordings.get("asset-rapid-restart");
    expect(recording).toBeDefined();
    expect(recording?.stream_session_id).toBe(session1.id);
  });

  it("handles video.upload.asset_created and correlates session", async () => {
    const session = db.addSession({
      id: "sess-upload-direct",
      user_id: USER_ID,
    });

    const evt = createEvent("video.upload.asset_created", {
      id: "upload-123",
      asset_id: "asset-from-upload",
      playback_ids: [{ id: "pb-upload" }],
      passthrough: JSON.stringify({
        sessionId: session.id,
        userId: USER_ID,
      }),
    });

    const res = await deliver(mainWebhook, evt);
    expect(res.status).toBe(200);

    const recording = db.state.stream_recordings.get("asset-from-upload");
    expect(recording).toBeDefined();
    expect(recording?.stream_session_id).toBe(session.id);
    expect(recording?.user_id).toBe(USER_ID);
  });

  it("handles duplicate webhook delivery idempotently without corrupting attribution", async () => {
    const session = db.addSession({
      id: "sess-idempotent-e2e",
      user_id: USER_ID,
    });

    const evt = createEvent(
      "video.asset.ready",
      {
        id: "asset-dedup-1",
        playback_ids: [{ id: "pb-dedup-1" }],
        duration: 500,
        live_stream_id: STREAM_ID,
        passthrough: JSON.stringify({ sessionId: session.id }),
      },
      "evt-dedup-fixed-id"
    );

    // First delivery
    const res1 = await deliver(mainWebhook, evt);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1).toEqual({ received: true });

    const recordingBefore = db.state.stream_recordings.get("asset-dedup-1");
    expect(recordingBefore?.stream_session_id).toBe(session.id);

    // Duplicate delivery
    const res2 = await deliver(mainWebhook, evt);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2).toEqual({ received: true, duplicate: true });

    const recordingAfter = db.state.stream_recordings.get("asset-dedup-1");
    expect(recordingAfter?.stream_session_id).toBe(session.id);
    expect(recordingAfter?.status).toBe("ready");
  });
});
