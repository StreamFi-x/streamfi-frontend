/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { __resetBanners } from "../store";

function putReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel/banner", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getReq(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/channel/banner${query}`
  );
}

beforeEach(() => {
  __resetBanners();
});

describe("GET /api/routes-f/channel/banner", () => {
  it("requires creator_id", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("returns defaults when no banner is set", async () => {
    const res = await GET(getReq("?creator_id=creator_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.banner_url).toBe("");
    expect(body.focal_point).toEqual({ x: 0.5, y: 0.5 });
  });

  it("returns the stored banner", async () => {
    await PUT(
      putReq({
        creator_id: "creator_1",
        banner_url: "https://cdn.example.com/banner.png",
        focal_point: { x: 0.3, y: 0.7 },
      })
    );
    const res = await GET(getReq("?creator_id=creator_1"));
    const body = await res.json();
    expect(body.banner_url).toBe("https://cdn.example.com/banner.png");
    expect(body.focal_point).toEqual({ x: 0.3, y: 0.7 });
  });
});

describe("PUT /api/routes-f/channel/banner", () => {
  it("updates banner with a focal point", async () => {
    const res = await PUT(
      putReq({
        creator_id: "creator_1",
        banner_url: "https://cdn.example.com/b.png",
        focal_point: { x: 0.1, y: 0.9 },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.banner_url).toBe("https://cdn.example.com/b.png");
    expect(body.focal_point).toEqual({ x: 0.1, y: 0.9 });
  });

  it("defaults focal_point to center when omitted on first set", async () => {
    const res = await PUT(
      putReq({
        creator_id: "creator_2",
        banner_url: "https://cdn.example.com/b.png",
      })
    );
    const body = await res.json();
    expect(body.focal_point).toEqual({ x: 0.5, y: 0.5 });
  });

  it("preserves prior focal_point when omitted on subsequent updates", async () => {
    await PUT(
      putReq({
        creator_id: "creator_3",
        banner_url: "https://cdn.example.com/a.png",
        focal_point: { x: 0.2, y: 0.4 },
      })
    );
    const res = await PUT(
      putReq({
        creator_id: "creator_3",
        banner_url: "https://cdn.example.com/b.png",
      })
    );
    const body = await res.json();
    expect(body.banner_url).toBe("https://cdn.example.com/b.png");
    expect(body.focal_point).toEqual({ x: 0.2, y: 0.4 });
  });

  it("requires creator_id", async () => {
    const res = await PUT(
      putReq({ banner_url: "https://cdn.example.com/b.png" })
    );
    expect(res.status).toBe(400);
  });

  it("requires banner_url", async () => {
    const res = await PUT(putReq({ creator_id: "creator_4" }));
    expect(res.status).toBe(400);
  });

  it.each([
    [{ x: -0.1, y: 0.5 }, "x below range"],
    [{ x: 1.1, y: 0.5 }, "x above range"],
    [{ x: 0.5, y: -0.1 }, "y below range"],
    [{ x: 0.5, y: 1.1 }, "y above range"],
    [{ x: "0", y: 0.5 }, "x not a number"],
    [{ y: 0.5 }, "x missing"],
    [{ x: 0.5 }, "y missing"],
  ])("rejects invalid focal_point (%j — %s)", async (focal_point) => {
    const res = await PUT(
      putReq({
        creator_id: "creator_5",
        banner_url: "https://cdn.example.com/b.png",
        focal_point,
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts focal point boundaries 0 and 1", async () => {
    const res = await PUT(
      putReq({
        creator_id: "creator_6",
        banner_url: "https://cdn.example.com/b.png",
        focal_point: { x: 0, y: 1 },
      })
    );
    expect(res.status).toBe(200);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/channel/banner",
      {
        method: "PUT",
        body: "{not json",
        headers: { "content-type": "application/json" },
      }
    );
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
