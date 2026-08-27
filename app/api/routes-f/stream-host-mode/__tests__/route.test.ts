/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";
import { hostModeStore } from "../../stream-host-mode-clear/seedData";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-host-mode", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Seed independent channels for this suite so mutating them here never
// interferes with stream-host-mode-clear's own tests against channel-1/
// channel-2/channel-3, since both suites share the same underlying store.
beforeEach(() => {
  hostModeStore.set("host-a", { channel_id: "host-a", hosted_channel_id: null, started_at: null });
  hostModeStore.set("host-b", { channel_id: "host-b", hosted_channel_id: null, started_at: null });
});

describe("POST /api/routes-f/stream-host-mode", () => {
  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when channel_id is missing", async () => {
    const res = await POST(makeReq({ target_channel_id: "host-b" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when target_channel_id is missing", async () => {
    const res = await POST(makeReq({ channel_id: "host-a" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a channel tries to host itself", async () => {
    const res = await POST(makeReq({ channel_id: "host-a", target_channel_id: "host-a" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown channel_id", async () => {
    const res = await POST(makeReq({ channel_id: "nope", target_channel_id: "host-b" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown target_channel_id", async () => {
    const res = await POST(makeReq({ channel_id: "host-a", target_channel_id: "nope" }));
    expect(res.status).toBe(404);
  });

  it("sets the hosted channel and returns the updated state", async () => {
    const res = await POST(makeReq({ channel_id: "host-a", target_channel_id: "host-b" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel_id).toBe("host-a");
    expect(body.hosted_channel_id).toBe("host-b");
    expect(body.started_at).toBeTruthy();

    expect(hostModeStore.get("host-a")?.hosted_channel_id).toBe("host-b");
  });

  it("overwrites a previous host selection when set again", async () => {
    await POST(makeReq({ channel_id: "host-a", target_channel_id: "host-b" }));
    hostModeStore.set("host-c", { channel_id: "host-c", hosted_channel_id: null, started_at: null });

    const res = await POST(makeReq({ channel_id: "host-a", target_channel_id: "host-c" }));
    const body = await res.json();

    expect(body.hosted_channel_id).toBe("host-c");
  });
});
