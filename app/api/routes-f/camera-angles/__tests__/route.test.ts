/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { getViewerAngle, resetStore } from "../store";

function getReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/camera-angles${query}`
  );
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/camera-angles", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetStore();
});

describe("GET /api/routes-f/camera-angles", () => {
  it("requires stream_id", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("404s for an unknown stream", async () => {
    const res = await GET(getReq("?stream_id=nope"));
    expect(res.status).toBe(404);
  });

  it("lists angles for a multi-angle stream", async () => {
    const res = await GET(getReq("?stream_id=stream_multi_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.angles).toHaveLength(3);
    expect(body.angles[0]).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      playback_id: expect.any(String),
    });
    expect(body.angles.map((a: { id: string }) => a.id)).toEqual([
      "main",
      "caster",
      "map",
    ]);
  });
});

describe("POST /api/routes-f/camera-angles", () => {
  it("requires viewer_id, stream_id, and angle_id", async () => {
    const res = await POST(postReq({ stream_id: "stream_multi_1" }));
    expect(res.status).toBe(400);
  });

  it("404s for an unknown stream", async () => {
    const res = await POST(
      postReq({
        viewer_id: "v1",
        stream_id: "nope",
        angle_id: "main",
      })
    );
    expect(res.status).toBe(404);
  });

  it("rejects an unknown angle", async () => {
    const res = await POST(
      postReq({
        viewer_id: "v1",
        stream_id: "stream_multi_1",
        angle_id: "backstage",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("angle_id");
  });

  it("stores the viewer's angle selection", async () => {
    const res = await POST(
      postReq({
        viewer_id: "v1",
        stream_id: "stream_multi_1",
        angle_id: "caster",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      viewer_id: "v1",
      stream_id: "stream_multi_1",
      angle_id: "caster",
    });
    expect(getViewerAngle("v1", "stream_multi_1")?.angle_id).toBe("caster");
  });

  it("overwrites a previous selection for the same viewer+stream", async () => {
    await POST(
      postReq({
        viewer_id: "v2",
        stream_id: "stream_multi_2",
        angle_id: "stage",
      })
    );
    await POST(
      postReq({
        viewer_id: "v2",
        stream_id: "stream_multi_2",
        angle_id: "crowd",
      })
    );
    expect(getViewerAngle("v2", "stream_multi_2")?.angle_id).toBe("crowd");
  });
});
