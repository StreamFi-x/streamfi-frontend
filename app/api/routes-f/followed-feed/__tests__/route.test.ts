/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeGet(viewer_id?: string) {
  const url = viewer_id
    ? `http://localhost/api/routes-f/followed-feed?viewer_id=${viewer_id}`
    : "http://localhost/api/routes-f/followed-feed";
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/routes-f/followed-feed", () => {
  it("400 when viewer_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns empty feed for viewer with no follows", async () => {
    const res = await GET(makeGet("unknown-viewer"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.live).toHaveLength(0);
    expect(data.offline_recently).toHaveLength(0);
  });

  it("returns all-live when followed creators are live (viewer-2 follows alpha+delta, alpha is live)", async () => {
    const res = await GET(makeGet("viewer-2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // creator-alpha is live; creator-delta is offline_recently
    expect(data.live.some((s: { creator_id: string }) => s.creator_id === "creator-alpha")).toBe(true);
    expect(data.offline_recently.some((s: { creator_id: string }) => s.creator_id === "creator-delta")).toBe(true);
  });

  it("returns all-offline when followed creator went offline recently (viewer-3 follows gamma)", async () => {
    const res = await GET(makeGet("viewer-3"));
    const data = await res.json();
    expect(data.live).toHaveLength(0);
    expect(data.offline_recently).toHaveLength(1);
    expect(data.offline_recently[0].creator_id).toBe("creator-gamma");
  });

  it("returns mixed live and offline_recently (viewer-1 follows all)", async () => {
    const res = await GET(makeGet("viewer-1"));
    const data = await res.json();
    // alpha + beta are live, gamma + delta are offline_recently
    expect(data.live.length).toBeGreaterThanOrEqual(1);
    expect(data.offline_recently.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for viewer following creator with no stream data (viewer-4)", async () => {
    const res = await GET(makeGet("viewer-4"));
    const data = await res.json();
    expect(data.live).toHaveLength(0);
    expect(data.offline_recently).toHaveLength(0);
  });
});
