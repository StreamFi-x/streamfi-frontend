import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-raid-initiate",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/stream-raid-initiate", () => {
  it("initiates a pending raid with a 10 second redirect delay", async () => {
    const before = Date.now();
    const res = await POST(
      makePost({ channel_id: "channel-1", targetChannelId: "channel-2" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.raid.status).toBe("pending");
    expect(body.raid.from_channel_id).toBe("channel-1");
    expect(body.raid.to_channel_id).toBe("channel-2");
    expect(body.raid.cancelled_at).toBeNull();

    const initiatedAt = new Date(body.raid.initiated_at).getTime();
    const redirectAt = new Date(body.raid.redirect_at).getTime();
    expect(redirectAt - initiatedAt).toBe(10_000);
    expect(initiatedAt).toBeGreaterThanOrEqual(before);
  });

  it("returns 400 when channel_id is missing", async () => {
    const res = await POST(makePost({ targetChannelId: "channel-2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetChannelId is missing", async () => {
    const res = await POST(makePost({ channel_id: "channel-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a channel tries to raid itself", async () => {
    const res = await POST(
      makePost({ channel_id: "channel-1", targetChannelId: "channel-1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = new NextRequest(
      "http://localhost/api/routes-f/stream-raid-initiate",
      { method: "POST", body: "not json", headers: { "Content-Type": "application/json" } }
    );
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });

  it("generates a unique raid_id for each initiated raid", async () => {
    const res1 = await POST(
      makePost({ channel_id: "channel-1", targetChannelId: "channel-2" })
    );
    const res2 = await POST(
      makePost({ channel_id: "channel-1", targetChannelId: "channel-3" })
    );
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.raid.raid_id).not.toBe(body2.raid.raid_id);
  });
});
