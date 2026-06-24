/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, prefsStore } from "../route";

const BASE_URL = "http://localhost/api/routes-f/notification-preferences";
const VIEWER_ID = "v-0001-0000-4000-8000-000000000001";
const OTHER_VIEWER = "v-0002-0000-4000-8000-000000000002";

function makeGet(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: "GET" });
}

function makePut(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/routes-f/notification-preferences", () => {
  beforeEach(() => prefsStore.clear());

  it("returns defaults (all true except email_digest) for unknown viewer", async () => {
    const res = await GET(makeGet({ viewer_id: VIEWER_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      live_alerts: true,
      tips_received: true,
      chat_mentions: true,
      email_digest: false,
    });
  });

  it("returns stored prefs after a PUT", async () => {
    await PUT(makePut({ viewer_id: VIEWER_ID, live_alerts: false, email_digest: true }));
    const res = await GET(makeGet({ viewer_id: VIEWER_ID }));
    const body = await res.json();
    expect(body.live_alerts).toBe(false);
    expect(body.email_digest).toBe(true);
    // untouched fields keep their defaults
    expect(body.tips_received).toBe(true);
    expect(body.chat_mentions).toBe(true);
  });

  it("different viewers have independent prefs", async () => {
    await PUT(makePut({ viewer_id: VIEWER_ID, live_alerts: false }));
    const res = await GET(makeGet({ viewer_id: OTHER_VIEWER }));
    const body = await res.json();
    expect(body.live_alerts).toBe(true);
  });

  it("400 — missing viewer_id", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/routes-f/notification-preferences", () => {
  beforeEach(() => prefsStore.clear());

  it("updates a single field, leaves others at defaults", async () => {
    const res = await PUT(makePut({ viewer_id: VIEWER_ID, chat_mentions: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chat_mentions).toBe(false);
    expect(body.live_alerts).toBe(true);
    expect(body.tips_received).toBe(true);
    expect(body.email_digest).toBe(false);
  });

  it("updates all four fields at once", async () => {
    const res = await PUT(
      makePut({
        viewer_id: VIEWER_ID,
        live_alerts: false,
        tips_received: false,
        chat_mentions: false,
        email_digest: true,
      })
    );
    const body = await res.json();
    expect(body).toEqual({
      live_alerts: false,
      tips_received: false,
      chat_mentions: false,
      email_digest: true,
    });
  });

  it("second PUT merges on top of first", async () => {
    await PUT(makePut({ viewer_id: VIEWER_ID, live_alerts: false }));
    await PUT(makePut({ viewer_id: VIEWER_ID, email_digest: true }));
    const res = await GET(makeGet({ viewer_id: VIEWER_ID }));
    const body = await res.json();
    expect(body.live_alerts).toBe(false);
    expect(body.email_digest).toBe(true);
  });

  it("400 — missing viewer_id", async () => {
    const res = await PUT(makePut({ live_alerts: false }));
    expect(res.status).toBe(400);
  });

  it("400 — invalid JSON body", async () => {
    const res = await PUT(
      new NextRequest(BASE_URL, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      })
    );
    expect(res.status).toBe(400);
  });
});
