/**
 * @jest-environment node
 *
 * #1397 — persistent Mux webhook replay protection, exercised through the
 * real webhook endpoints against a fake Postgres that models transactions,
 * rollback and the mux_webhook_events primary key.
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
import { POST as liveWebhook } from "@/app/api/routes-f/webhooks-mux-live/route";
import { POST as assetWebhook } from "@/app/api/routes-f/webhooks-mux-asset/route";
import { GET as purgeCron } from "@/app/api/routes-f/cron-purge-mux-webhook-events/route";
import { verifyMuxWebhookSignature } from "@/lib/mux/webhook";
import { purgeExpiredMuxWebhookEvents } from "@/lib/mux/webhook-retention";
import {
  MemoryKvStore,
  setSecurityKvStoreForTesting,
} from "@/lib/security/kv-store";

const SECRET = "SENTINEL-mux-webhook-secret";
const STREAM = "mux-stream-1";
const ORIGINAL_ENV = process.env;
const fetchMock = jest.fn();

type Handler = (req: NextRequest) => Promise<Response>;

let eventSeq = 0;
function event(type: string, data: Record<string, unknown>, id?: string) {
  return {
    id: id ?? `evt-${++eventSeq}`,
    type,
    created_at: new Date().toISOString(),
    data,
  };
}

function sign(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/** Mux signs every delivery attempt afresh, so each call re-signs. */
function deliver(handler: Handler, evt: object, signature?: string) {
  const body = JSON.stringify(evt);
  return handler(
    new NextRequest("http://localhost/webhook", {
      method: "POST",
      headers: { "mux-signature": signature ?? sign(body) },
      body,
    })
  );
}

function seedStreamer(overrides: Record<string, unknown> = {}) {
  return db.addUser({
    id: "user-1",
    mux_stream_id: STREAM,
    mux_playback_id: "pb-1",
    creator: { title: "Speedrun" },
    ...overrides,
  });
}

let logSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  db.reset();
  setSecurityKvStoreForTesting(new MemoryKvStore());
  process.env = { ...ORIGINAL_ENV, MUX_WEBHOOK_SECRET: SECRET };
  fetchMock.mockReset().mockResolvedValue(new Response("ok"));
  global.fetch = fetchMock as unknown as typeof fetch;
  logSpies = (["log", "warn", "error", "info"] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => {})
  );
});

afterEach(() => logSpies.forEach(s => s.mockRestore()));

afterAll(() => {
  process.env = ORIGINAL_ENV;
  setSecurityKvStoreForTesting(null);
});

describe("first delivery and duplicates", () => {
  it("processes the first delivery and records the event id", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });

    const res = await deliver(liveWebhook, evt);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(db.user("user-1").is_live).toBe(true);
    expect(db.openSessions("user-1")).toHaveLength(1);
    expect(db.state.mux_webhook_events.get(evt.id)).toMatchObject({
      status: "processed",
      event_type: "video.live_stream.active",
      object_id: STREAM,
      attempts: 1,
    });
  });

  it("acknowledges a redelivery without re-running side effects", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });
    await deliver(liveWebhook, evt);
    const startedAt = db.user("user-1").stream_started_at;

    db.advance(60_000);
    const res = await deliver(liveWebhook, evt);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(db.user("user-1").stream_started_at).toEqual(startedAt);
    expect(db.state.stream_sessions).toHaveLength(1);
    expect(
      db.statements.filter(s => s.startsWith("UPDATE users"))
    ).toHaveLength(1);
  });

  it("runs side effects exactly once for concurrent duplicate deliveries", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => deliver(liveWebhook, evt))
    );
    const bodies = await Promise.all(responses.map(r => r.json()));

    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(bodies.filter(b => !b.duplicate)).toHaveLength(1);
    expect(db.state.stream_sessions).toHaveLength(1);
    expect(
      db.statements.filter(s => s.startsWith("UPDATE users"))
    ).toHaveLength(1);
  });

  it("deduplicates across endpoints subscribed to the same event", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });
    await deliver(mainWebhook, evt);
    const res = await deliver(liveWebhook, evt);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(db.state.stream_sessions).toHaveLength(1);
  });

  it("recognises a legitimately delayed redelivery hours later", async () => {
    seedStreamer();
    const idle = event("video.live_stream.idle", { id: STREAM });
    db.user("user-1").is_live = true;
    await deliver(liveWebhook, idle);

    // The streamer goes live again, then Mux's delayed retry of the OLD idle
    // event arrives (freshly signed, so it passes the 300s window).
    await deliver(
      liveWebhook,
      event("video.live_stream.active", { id: STREAM })
    );
    db.advance(6 * 60 * 60_000);
    const res = await deliver(liveWebhook, idle);

    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(db.user("user-1").is_live).toBe(true);
    expect(db.openSessions("user-1")).toHaveLength(1);
  });

  it("still rejects a captured request replayed outside the signature window", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });
    const body = JSON.stringify(evt);
    const stale = sign(body, Math.floor(Date.now() / 1000) - 301);
    const res = await deliver(liveWebhook, evt, stale);
    expect(res.status).toBe(401);
    expect(db.state.mux_webhook_events.size).toBe(0);
  });
});

describe("failure semantics", () => {
  it("rolls back and stays retryable when processing fails", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });
    db.failOn(/^INSERT INTO stream_sessions/, new Error("db blip"));

    const failed = await deliver(liveWebhook, evt);
    expect(failed.status).toBe(500);
    expect(db.user("user-1").is_live).toBe(false);
    expect(db.state.stream_sessions).toHaveLength(0);
    expect(db.state.mux_webhook_events.get(evt.id)).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: "db blip",
    });

    const retried = await deliver(liveWebhook, evt);
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ received: true });
    expect(db.user("user-1").is_live).toBe(true);
    expect(db.openSessions("user-1")).toHaveLength(1);
    expect(db.state.mux_webhook_events.get(evt.id)).toMatchObject({
      status: "processed",
      attempts: 2,
      last_error: null,
    });

    const again = await deliver(liveWebhook, evt);
    expect(await again.json()).toEqual({ received: true, duplicate: true });
  });

  it("alerts once an event has failed repeatedly", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://hooks.example.test/ops";
    seedStreamer();
    const evt = event("video.live_stream.idle", { id: STREAM });
    db.failOn(/^UPDATE users SET is_live = false/, new Error("deadlock"), 4);

    for (let i = 0; i < 4; i++) {
      expect((await deliver(liveWebhook, evt)).status).toBe(500);
    }
    expect(db.state.mux_webhook_events.get(evt.id)?.attempts).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const text = JSON.parse(fetchMock.mock.calls[0][1].body).text;
    expect(text).toContain(evt.id);
  });

  it("does not record a failure while the original delivery is still in flight", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });
    db.failOn(
      /^INSERT INTO mux_webhook_events .* 'processed'/,
      Object.assign(new Error("lock timeout"), { code: "55P03" })
    );
    const res = await deliver(liveWebhook, evt);
    expect(res.status).toBe(500);
    expect(db.state.mux_webhook_events.has(evt.id)).toBe(false);
  });

  it("rejects side-effecting events that carry no event id", async () => {
    seedStreamer();
    const res = await deliver(liveWebhook, {
      type: "video.live_stream.active",
      data: { id: STREAM },
    });
    expect(res.status).toBe(400);
    expect(db.user("user-1").is_live).toBe(false);
  });

  it("does not touch the store for log-only events", async () => {
    const res = await deliver(
      liveWebhook,
      event("video.live_stream.connected", { id: STREAM })
    );
    expect(res.status).toBe(200);
    expect(db.statements).toHaveLength(0);
  });
});

describe("every side-effecting event type is protected", () => {
  it.each([
    ["webhooks/mux", mainWebhook],
    ["routes-f/webhooks-mux-live", liveWebhook],
  ])("video.live_stream.idle via %s", async (_label, handler) => {
    seedStreamer({ is_live: true });
    await deliver(handler, event("video.live_stream.active", { id: STREAM }));
    const idle = event("video.live_stream.idle", { id: STREAM });
    await deliver(handler, idle);
    await deliver(handler, event("video.live_stream.active", { id: STREAM }));

    const res = await deliver(handler, idle);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.user("user-1").is_live).toBe(true);
    expect(db.state.stream_sessions.filter(s => s.ended_at)).toHaveLength(1);
  });

  it.each([
    ["webhooks/mux", mainWebhook, 0],
    ["routes-f/webhooks-mux-asset", assetWebhook, 1],
  ])("video.asset.ready via %s", async (_label, handler, notifications) => {
    seedStreamer();
    const ready = event("video.asset.ready", {
      id: "asset-1",
      playback_ids: [{ id: "vod-pb" }],
      duration: 125.4,
      live_stream_id: STREAM,
    });
    await deliver(handler, ready);
    db.state.stream_recordings.get("asset-1")!.needs_review = false;

    const res = await deliver(handler, ready);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.state.stream_recordings.get("asset-1")).toMatchObject({
      status: "ready",
      duration: 125,
      needs_review: false,
    });
    expect(db.user("user-1").notifications).toHaveLength(notifications);
  });

  it.each([
    ["webhooks/mux", mainWebhook, 0],
    ["routes-f/webhooks-mux-asset", assetWebhook, 1],
  ])("video.asset.errored via %s", async (_label, handler, notifications) => {
    seedStreamer();
    db.state.stream_recordings.set("asset-2", {
      user_id: "user-1",
      mux_asset_id: "asset-2",
      status: "preparing",
    });
    const errored = event("video.asset.errored", { id: "asset-2" });
    await deliver(handler, errored);
    await deliver(handler, errored);
    expect(db.state.stream_recordings.get("asset-2")?.status).toBe("error");
    expect(db.user("user-1").notifications).toHaveLength(notifications);
  });

  it("video.asset.deleted via routes-f/webhooks-mux-asset", async () => {
    seedStreamer();
    const readyPayload = {
      id: "asset-3",
      playback_ids: [{ id: "vod-pb" }],
      duration: 10,
      live_stream_id: STREAM,
    };
    await deliver(assetWebhook, event("video.asset.ready", readyPayload));
    const deleted = event("video.asset.deleted", { id: "asset-3" });
    await deliver(assetWebhook, deleted);
    expect(db.state.stream_recordings.has("asset-3")).toBe(false);

    // Re-created later; replaying the old delete must not remove it again.
    await deliver(assetWebhook, event("video.asset.ready", readyPayload));
    const res = await deliver(assetWebhook, deleted);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.state.stream_recordings.has("asset-3")).toBe(true);
  });
});

describe("signature verification", () => {
  const body = '{"type":"x"}';
  const now = 1_800_000_000_000;
  const header = (t: number) =>
    `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;

  it("accepts a fresh, correctly signed payload", () => {
    expect(
      verifyMuxWebhookSignature(header(now / 1000), body, SECRET, now)
    ).toBe(true);
  });

  it("rejects stale, tampered, malformed and non-numeric timestamps", () => {
    expect(
      verifyMuxWebhookSignature(header(now / 1000 - 301), body, SECRET, now)
    ).toBe(false);
    expect(
      verifyMuxWebhookSignature(header(now / 1000), `${body} `, SECRET, now)
    ).toBe(false);
    expect(verifyMuxWebhookSignature("garbage", body, SECRET, now)).toBe(false);
    expect(verifyMuxWebhookSignature("t=abc,v1=00", body, SECRET, now)).toBe(
      false
    );
  });
});

describe("retention and cleanup", () => {
  const DAY = 86_400_000;

  async function processedEventAgedDays(id: string, ageDays: number) {
    seedStreamer();
    await deliver(
      liveWebhook,
      event("video.live_stream.connected", { id: STREAM })
    );
    db.state.mux_webhook_events.set(id, {
      event_id: id,
      status: "processed",
      received_at: new Date(db.clock.getTime() - ageDays * DAY),
      processed_at: new Date(db.clock.getTime() - ageDays * DAY),
    });
  }

  it("purges processed events past the retention window only", async () => {
    await processedEventAgedDays("old", 8);
    await processedEventAgedDays("recent", 6);
    db.state.mux_webhook_events.set("failed-recent", {
      event_id: "failed-recent",
      status: "failed",
      received_at: new Date(db.clock.getTime() - 20 * DAY),
    });
    db.state.mux_webhook_events.set("failed-old", {
      event_id: "failed-old",
      status: "failed",
      received_at: new Date(db.clock.getTime() - 31 * DAY),
    });

    const result = await purgeExpiredMuxWebhookEvents();

    expect(result).toMatchObject({
      deleted: 2,
      complete: true,
      retention_days: 7,
    });
    expect([...db.state.mux_webhook_events.keys()].sort()).toEqual([
      "failed-recent",
      "recent",
    ]);
  });

  it("never lets retention drop below the Mux retry horizon", async () => {
    process.env.MUX_WEBHOOK_EVENT_RETENTION_DAYS = "0";
    await processedEventAgedDays("one-day", 1);
    const result = await purgeExpiredMuxWebhookEvents();
    expect(result.retention_days).toBe(2);
    expect(db.state.mux_webhook_events.has("one-day")).toBe(true);
  });

  it("purges in bounded batches and reports when more remain", async () => {
    for (let i = 0; i < 7; i++) {
      await processedEventAgedDays(`bulk-${i}`, 10);
    }
    const first = await purgeExpiredMuxWebhookEvents({
      batchSize: 3,
      maxBatches: 2,
    });
    expect(first).toMatchObject({ deleted: 6, complete: false });
    const second = await purgeExpiredMuxWebhookEvents({
      batchSize: 3,
      maxBatches: 2,
    });
    expect(second).toMatchObject({ deleted: 1, complete: true });
  });

  it("keeps protecting a retained event after cleanup runs", async () => {
    seedStreamer();
    const evt = event("video.live_stream.active", { id: STREAM });
    await deliver(liveWebhook, evt);
    db.advance(3 * DAY);
    await purgeExpiredMuxWebhookEvents();
    const res = await deliver(liveWebhook, evt);
    expect(await res.json()).toMatchObject({ duplicate: true });
  });

  it("runs from the cron route only with the cron secret", async () => {
    process.env.CRON_SECRET = "SENTINEL-cron-secret";
    const unauth = await purgeCron(new Request("http://localhost/cron"));
    expect(unauth.status).toBe(401);

    await processedEventAgedDays("old", 9);
    const res = await purgeCron(
      new Request("http://localhost/cron", {
        headers: { authorization: "Bearer SENTINEL-cron-secret" },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.summary.deleted).toBe(1);
    // Reconciliation has never succeeded in this fake DB → flagged stale.
    expect(body.reconciliation_fresh).toBe(false);
  });
});
