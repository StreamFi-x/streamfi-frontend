/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { POST } from "../viewer-confirm/route";
import { ratings, matureConfirmations, getRating } from "../store";

function makeGet(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/channel-content-rating${query}`);
}
function makePut(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel-content-rating", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function makeConfirm(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/channel-content-rating/viewer-confirm",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}

afterEach(() => {
  ratings.set("creator-family", "family");
  ratings.set("creator-teen", "teen");
  ratings.set("creator-mature", "mature");
  matureConfirmations.set("creator-mature", new Set(["viewer-verified-1"]));
});

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /channel-content-rating", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns seeded family rating", async () => {
    const res = await GET(makeGet("?creator_id=creator-family"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rating).toBe("family");
  });

  it("defaults to family for unknown creator", async () => {
    const res = await GET(makeGet("?creator_id=unknown-creator"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rating).toBe("family");
  });
});

// ── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /channel-content-rating", () => {
  it("sets a new rating", async () => {
    const res = await PUT(makePut({ creator_id: "creator-new", rating: "teen" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rating).toBe("teen");
    expect(getRating("creator-new")).toBe("teen");
  });

  it("updates an existing rating", async () => {
    await PUT(makePut({ creator_id: "creator-family", rating: "mature" }));
    expect(getRating("creator-family")).toBe("mature");
  });

  it("returns 400 for invalid rating value", async () => {
    const res = await PUT(makePut({ creator_id: "creator-x", rating: "kids" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id missing", async () => {
    const res = await PUT(makePut({ rating: "teen" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rating missing", async () => {
    const res = await PUT(makePut({ creator_id: "c1" }));
    expect(res.status).toBe(400);
  });
});

// ── POST /viewer-confirm ──────────────────────────────────────────────────────

describe("POST /viewer-confirm", () => {
  it("records a mature confirmation", async () => {
    const res = await POST(makeConfirm({
      viewer_id: "viewer-new",
      creator_id: "creator-mature",
      accept_mature: true,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(matureConfirmations.get("creator-mature")?.has("viewer-new")).toBe(true);
  });

  it("revokes a mature confirmation when accept_mature=false", async () => {
    const res = await POST(makeConfirm({
      viewer_id: "viewer-verified-1",
      creator_id: "creator-mature",
      accept_mature: false,
    }));
    expect(res.status).toBe(200);
    expect(matureConfirmations.get("creator-mature")?.has("viewer-verified-1")).toBe(false);
  });

  it("returns 422 when creator rating is not mature", async () => {
    const res = await POST(makeConfirm({
      viewer_id: "viewer-1",
      creator_id: "creator-family",
      accept_mature: true,
    }));
    expect(res.status).toBe(422);
  });

  it("returns 400 when viewer_id missing", async () => {
    const res = await POST(makeConfirm({ creator_id: "creator-mature", accept_mature: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when accept_mature is not boolean", async () => {
    const res = await POST(makeConfirm({
      viewer_id: "v1", creator_id: "creator-mature", accept_mature: "yes",
    }));
    expect(res.status).toBe(400);
  });
});
