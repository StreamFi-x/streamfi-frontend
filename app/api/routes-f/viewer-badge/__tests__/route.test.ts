/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, DELETE, badgeStore } from "../route";

const BASE_URL = "http://localhost/api/routes-f/viewer-badge";

function makeGet(params?: { creator_id?: string; viewer_id?: string }) {
  const url = params
    ? `${BASE_URL}?creator_id=${params.creator_id}&viewer_id=${params.viewer_id}`
    : BASE_URL;
  return new NextRequest(url, { method: "GET" });
}

function makePost(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CREATOR = "creator-xyz";
const VIEWER = "viewer-abc";
const GRANTER = "mod-user-1";

describe("/api/routes-f/viewer-badge", () => {
  beforeEach(() => badgeStore.clear());

  // ── grant ─────────────────────────────────────────────────────────────────

  it("POST 201 grants a badge and returns granted_at", async () => {
    const res = await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.granted_at).toBeTruthy();
    expect(new Date(body.granted_at).toString()).not.toBe("Invalid Date");
  });

  it("POST 201 grants multiple different badges to the same viewer", async () => {
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    const res = await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "vip", granted_by: GRANTER }));
    expect(res.status).toBe(201);
  });

  it("POST 409 when viewer already has the same badge", async () => {
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "og", granted_by: GRANTER }));
    const res = await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "og", granted_by: GRANTER }));
    expect(res.status).toBe(409);
  });

  it("POST 422 when viewer already has 5 badges (cap exceeded)", async () => {
    // Pre-fill store with 5 entries; the target badge ("vip") is NOT among them
    // so the duplicate check passes and the cap check fires.
    const key = `${CREATOR}:viewer-capped`;
    const ts = new Date().toISOString();
    badgeStore.set(key, [
      { badge: "mod", granted_by: GRANTER, granted_at: ts },
      { badge: "og", granted_by: GRANTER, granted_at: ts },
      { badge: "founder", granted_by: GRANTER, granted_at: ts },
      { badge: "mod", granted_by: GRANTER, granted_at: ts },
      { badge: "og", granted_by: GRANTER, granted_at: ts },
    ]);
    // Request "vip" — not a duplicate, but length is already 5
    const res = await POST(makePost({ creator_id: CREATOR, viewer_id: "viewer-capped", badge: "vip", granted_by: GRANTER }));
    expect(res.status).toBe(422);
  });

  // ── revoke ────────────────────────────────────────────────────────────────

  it("DELETE revokes an existing badge", async () => {
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    const res = await DELETE(makeDelete({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(true);
  });

  it("DELETE 404 when viewer does not have the badge", async () => {
    const res = await DELETE(makeDelete({ creator_id: CREATOR, viewer_id: VIEWER, badge: "vip" }));
    expect(res.status).toBe(404);
  });

  it("DELETE removes only the specified badge, keeping others", async () => {
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "og", granted_by: GRANTER }));
    await DELETE(makeDelete({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod" }));
    const res = await GET(makeGet({ creator_id: CREATOR, viewer_id: VIEWER }));
    const { badges } = await res.json();
    expect(badges).toHaveLength(1);
    expect(badges[0].badge).toBe("og");
  });

  // ── listing ───────────────────────────────────────────────────────────────

  it("GET returns empty array for viewer with no badges", async () => {
    const res = await GET(makeGet({ creator_id: CREATOR, viewer_id: VIEWER }));
    expect(res.status).toBe(200);
    const { badges } = await res.json();
    expect(badges).toEqual([]);
  });

  it("GET returns all active badges for viewer", async () => {
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "founder", granted_by: GRANTER }));
    const res = await GET(makeGet({ creator_id: CREATOR, viewer_id: VIEWER }));
    const { badges } = await res.json();
    expect(badges).toHaveLength(2);
    const types = badges.map((b: { badge: string }) => b.badge);
    expect(types).toContain("mod");
    expect(types).toContain("founder");
  });

  it("GET badges are isolated per creator", async () => {
    await POST(makePost({ creator_id: "creator-A", viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    const res = await GET(makeGet({ creator_id: "creator-B", viewer_id: VIEWER }));
    const { badges } = await res.json();
    expect(badges).toHaveLength(0);
  });

  // ── validation ────────────────────────────────────────────────────────────

  it("POST 400 for invalid badge type", async () => {
    const res = await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "supermod", granted_by: GRANTER }));
    expect(res.status).toBe(400);
  });

  it("POST 400 when creator_id is missing", async () => {
    const res = await POST(makePost({ viewer_id: VIEWER, badge: "mod", granted_by: GRANTER }));
    expect(res.status).toBe(400);
  });

  it("POST 400 when granted_by is missing", async () => {
    const res = await POST(makePost({ creator_id: CREATOR, viewer_id: VIEWER, badge: "mod" }));
    expect(res.status).toBe(400);
  });

  it("GET 400 when creator_id or viewer_id is missing", async () => {
    const res = await GET(new NextRequest(`${BASE_URL}?creator_id=${CREATOR}`, { method: "GET" }));
    expect(res.status).toBe(400);
  });
});
