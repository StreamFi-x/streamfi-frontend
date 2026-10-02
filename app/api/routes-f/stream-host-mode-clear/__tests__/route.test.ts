/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { DELETE } from "../route";
import { hostModeStore } from "../seedData";

function makeReq(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/stream-host-mode-clear${query}`, {
    method: "DELETE",
  });
}

describe("DELETE /api/routes-f/stream-host-mode-clear", () => {
  it("returns 400 when channel_id is missing", async () => {
    const res = await DELETE(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown channel_id", async () => {
    const res = await DELETE(makeReq("?channel_id=nope"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the channel is not currently hosting anyone", async () => {
    const res = await DELETE(makeReq("?channel_id=channel-3"));
    expect(res.status).toBe(409);
  });

  it("clears the hosted channel and returns the cleared id", async () => {
    const res = await DELETE(makeReq("?channel_id=channel-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel_id).toBe("channel-1");
    expect(body.hosted_channel_id).toBeNull();
    expect(body.cleared_channel_id).toBe("channel-2");

    expect(hostModeStore.get("channel-1")?.hosted_channel_id).toBeNull();
  });

  it("returns 409 on a second clear attempt for the same channel", async () => {
    const first = await DELETE(makeReq("?channel_id=channel-1"));
    expect(first.status).toBe(200);

    const second = await DELETE(makeReq("?channel_id=channel-1"));
    expect(second.status).toBe(409);
  });
});
