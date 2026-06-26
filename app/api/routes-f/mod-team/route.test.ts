/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, DELETE, modStore } from "./route";

function makeGetReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/mod-team?${query}`
  );
}

function makePostReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/mod-team", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/mod-team", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/mod-team", () => {
  beforeEach(() => {
    modStore.clear();
  });

  it("GET returns moderators for a creator", async () => {
    // Seed a mod directly
    modStore.set("creator-1:viewer-1", {
      creator_id: "creator-1",
      viewer_id: "viewer-1",
      role: "mod",
      added_at: new Date().toISOString(),
    });

    const req = makeGetReq("creator_id=creator-1");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.moderators)).toBe(true);
    expect(data.moderators.length).toBe(1);
    expect(data.moderators[0].viewer_id).toBe("viewer-1");
    expect(data.moderators[0].role).toBe("mod");
  });

  it("POST assigns a moderator", async () => {
    const req = makePostReq({
      creator_id: "creator-1",
      viewer_id: "viewer-2",
      role: "mod",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.creator_id).toBe("creator-1");
    expect(data.viewer_id).toBe("viewer-2");
    expect(data.role).toBe("mod");
    expect(typeof data.added_at).toBe("string");
  });

  it("POST with existing mod updates role (upsert)", async () => {
    // First assign as mod
    await POST(
      makePostReq({ creator_id: "creator-1", viewer_id: "viewer-3", role: "mod" })
    );

    // Promote to sr_mod
    const req = makePostReq({
      creator_id: "creator-1",
      viewer_id: "viewer-3",
      role: "sr_mod",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.role).toBe("sr_mod");

    // Only one entry in store for this pair
    const getReq = makeGetReq("creator_id=creator-1");
    const getRes = await GET(getReq);
    const getData = await getRes.json();
    expect(getData.moderators.filter((m: { viewer_id: string }) => m.viewer_id === "viewer-3").length).toBe(1);
  });

  it("DELETE removes moderator", async () => {
    // Seed a mod
    modStore.set("creator-1:viewer-4", {
      creator_id: "creator-1",
      viewer_id: "viewer-4",
      role: "mod",
      added_at: new Date().toISOString(),
    });

    const req = makeDeleteReq({ creator_id: "creator-1", viewer_id: "viewer-4" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe("Moderator removed");

    // Confirm removal
    const getReq = makeGetReq("creator_id=creator-1");
    const getRes = await GET(getReq);
    const getData = await getRes.json();
    expect(getData.moderators.length).toBe(0);
  });

  it("POST returns 400 when cap of 20 is reached", async () => {
    // Add exactly 20 mods
    for (let i = 0; i < 20; i++) {
      modStore.set(`creator-1:viewer-cap-${i}`, {
        creator_id: "creator-1",
        viewer_id: `viewer-cap-${i}`,
        role: "mod",
        added_at: new Date().toISOString(),
      });
    }

    // The 21st should fail
    const req = makePostReq({
      creator_id: "creator-1",
      viewer_id: "viewer-overflow",
      role: "mod",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Cannot exceed 20/);
  });
});
