/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-raid-cancel", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/stream-raid-cancel", () => {
  it("cancels a pending raid initiated by the requesting channel", async () => {
    const res = await POST(
      makePost({ raid_id: "raid_pending_1", channel_id: "channel-1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.raid.status).toBe("cancelled");
    expect(body.raid.cancelled_at).not.toBeNull();
  });

  it("returns 404 for an unknown raid_id", async () => {
    const res = await POST(
      makePost({ raid_id: "does_not_exist", channel_id: "channel-1" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the requesting channel did not initiate the raid", async () => {
    const res = await POST(
      makePost({ raid_id: "raid_pending_2", channel_id: "channel-9" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when the raid already redirected", async () => {
    const res = await POST(
      makePost({ raid_id: "raid_already_redirected", channel_id: "channel-5" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the raid was already cancelled", async () => {
    const res = await POST(
      makePost({ raid_id: "raid_already_cancelled", channel_id: "channel-7" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when raid_id is missing", async () => {
    const res = await POST(makePost({ channel_id: "channel-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when channel_id is missing", async () => {
    const res = await POST(makePost({ raid_id: "raid_pending_2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-raid-cancel", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow cancelling the same raid twice", async () => {
    const first = await POST(
      makePost({ raid_id: "raid_pending_2", channel_id: "channel-3" })
    );
    expect(first.status).toBe(200);

    const second = await POST(
      makePost({ raid_id: "raid_pending_2", channel_id: "channel-3" })
    );
    expect(second.status).toBe(409);
  });
});
