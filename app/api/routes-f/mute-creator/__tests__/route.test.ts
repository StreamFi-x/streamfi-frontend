import { GET, POST, DELETE } from "../route";
import { __resetMuteStore } from "../_lib/store";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/mute-creator";

function req(method: string, body?: object, search?: string) {
  const url = search ? `${BASE}?${search}` : BASE;
  return new NextRequest(url, {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => {
  __resetMuteStore();
});

describe("POST /mute-creator — mute", () => {
  it("mutes a creator and returns muted_at", async () => {
    const res = await POST(req("POST", { follower_id: "user-1", creator_id: "creator-1" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.muted_at).toBe("string");
    expect(new Date(body.muted_at).getTime()).not.toBeNaN();
  });

  it("returns 409 when already muted", async () => {
    await POST(req("POST", { follower_id: "user-1", creator_id: "creator-1" }));
    const res = await POST(req("POST", { follower_id: "user-1", creator_id: "creator-1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already muted/i);
  });

  it("returns 400 when a user tries to mute themselves", async () => {
    const res = await POST(req("POST", { follower_id: "user-1", creator_id: "user-1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cannot mute themselves/i);
  });

  it("returns 400 when follower_id is missing", async () => {
    const res = await POST(req("POST", { creator_id: "creator-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(req("POST", { follower_id: "user-1" }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /mute-creator — unmute", () => {
  it("unmutes a previously muted creator", async () => {
    await POST(req("POST", { follower_id: "user-1", creator_id: "creator-1" }));
    const res = await DELETE(req("DELETE", { follower_id: "user-1", creator_id: "creator-1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/unmuted/i);
  });

  it("returns 404 when the mute record does not exist", async () => {
    const res = await DELETE(req("DELETE", { follower_id: "user-1", creator_id: "ghost-creator" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });
});

describe("GET /mute-creator — list muted creators", () => {
  it("returns an empty list when no creators are muted", async () => {
    const res = await GET(req("GET", undefined, "follower_id=user-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.muted).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it("lists all muted creators for the given follower", async () => {
    await POST(req("POST", { follower_id: "user-1", creator_id: "creator-a" }));
    await POST(req("POST", { follower_id: "user-1", creator_id: "creator-b" }));
    await POST(req("POST", { follower_id: "user-2", creator_id: "creator-a" }));

    const res = await GET(req("GET", undefined, "follower_id=user-1"));
    const body = await res.json();

    expect(body.count).toBe(2);
    expect(body.muted.map((r: { creator_id: string }) => r.creator_id).sort()).toEqual([
      "creator-a",
      "creator-b",
    ]);
  });

  it("does not include creators muted after an unmute", async () => {
    await POST(req("POST", { follower_id: "user-1", creator_id: "creator-a" }));
    await DELETE(req("DELETE", { follower_id: "user-1", creator_id: "creator-a" }));

    const res = await GET(req("GET", undefined, "follower_id=user-1"));
    expect((await res.json()).count).toBe(0);
  });

  it("returns 400 when follower_id query param is missing", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(400);
  });
});
