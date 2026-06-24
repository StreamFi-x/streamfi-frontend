/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import { prefsStore } from "@/app/api/routes-f/viewer-notification-prefs/route";

const BASE_URL = "http://localhost/api/routes-f/broadcast-live";

function makePostReq(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/broadcast-live", () => {
  beforeEach(() => {
    prefsStore.clear();
  });

  it("notifies all followers when none are muted and notify_live is default (true)", async () => {
    // creator-delta has 3 followers in seed; none are muted
    const res = await POST(
      makePostReq({ creator_id: "creator-delta", stream_title: "Delta Goes Live" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified_count).toBe(3);
  });

  it("skips muted followers", async () => {
    // creator-alpha has 5 followers; viewer-002 is muted → expects 4
    const res = await POST(
      makePostReq({
        creator_id: "creator-alpha",
        stream_title: "Alpha Stream",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified_count).toBe(4);
  });

  it("skips followers with notify_live (live_alerts) set to false in prefs store", async () => {
    // creator-beta has 3 followers: viewer-006, viewer-007, viewer-008
    // Set viewer-006 live_alerts = false
    prefsStore.set("viewer-006", {
      viewer_id: "viewer-006",
      live_alerts: false,
      tips_received: true,
      chat_mentions: true,
      email_digest: false,
    });

    const res = await POST(
      makePostReq({ creator_id: "creator-beta", stream_title: "Beta Live" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // viewer-006 (live_alerts false), viewer-007 (muted) → 1 notified
    expect(body.notified_count).toBe(1);
  });

  it("returns 0 when creator has no followers in seed", async () => {
    const res = await POST(
      makePostReq({
        creator_id: "creator-unknown-xyz",
        stream_title: "Nobody Watching",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified_count).toBe(0);
  });

  it("400 — missing creator_id", async () => {
    const res = await POST(makePostReq({ stream_title: "Missing Creator" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("400 — missing stream_title", async () => {
    const res = await POST(makePostReq({ creator_id: "creator-alpha" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("400 — missing both fields", async () => {
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
  });
});
