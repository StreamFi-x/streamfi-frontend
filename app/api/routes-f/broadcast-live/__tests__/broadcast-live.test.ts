/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

const BASE_URL = "http://localhost/api/routes-f/broadcast-live";

function makePost(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/broadcast-live", () => {
  it("notifies all eligible followers (notify_live=true and not muted)", async () => {
    // c-001 has 5 followers: f-001(✓), f-002(✓), f-003(notify_live=false), f-004(muted), f-005(✓) → 3 eligible
    const res = await POST(makePost({ creator_id: "c-001", stream_title: "Going Live!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified_count).toBe(3);
  });

  it("skips followers with notify_live=false", async () => {
    // c-002 has 3 followers: f-006(✓), f-007(✓), f-008(notify_live=false) → 2 eligible
    const res = await POST(makePost({ creator_id: "c-002", stream_title: "Art Stream" }));
    const body = await res.json();
    expect(body.notified_count).toBe(2);
  });

  it("skips muted followers", async () => {
    // f-004 follows c-001 but is muted — confirmed excluded in the c-001 test above
    const res = await POST(makePost({ creator_id: "c-001", stream_title: "Live Again" }));
    const body = await res.json();
    // 5 followers, minus notify_live=false (f-003) and muted (f-004) = 3
    expect(body.notified_count).toBe(3);
  });

  it("returns 0 for creator with no followers in seed", async () => {
    const res = await POST(makePost({ creator_id: "c-unknown-999", stream_title: "Solo" }));
    const body = await res.json();
    expect(body.notified_count).toBe(0);
  });

  it("400 — missing creator_id", async () => {
    const res = await POST(makePost({ stream_title: "No Creator" }));
    expect(res.status).toBe(400);
  });

  it("400 — missing stream_title", async () => {
    const res = await POST(makePost({ creator_id: "c-001" }));
    expect(res.status).toBe(400);
  });

  it("400 — invalid JSON body", async () => {
    const res = await POST(
      new NextRequest(BASE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json",
      })
    );
    expect(res.status).toBe(400);
  });
});
