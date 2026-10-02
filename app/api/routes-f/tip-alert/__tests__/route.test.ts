/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, store } from "../route";

function makeGet(creator_id?: string) {
  const url = creator_id
    ? `http://localhost/api/routes-f/tip-alert?creator_id=${creator_id}`
    : "http://localhost/api/routes-f/tip-alert";
  return new NextRequest(url, { method: "GET" });
}

function makePut(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/tip-alert", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/tip-alert", () => {
  beforeEach(() => store.clear());

  // ── GET ───────────────────────────────────────────────────────────────────

  it("GET returns default config for unknown creator", async () => {
    const res = await GET(makeGet("creator-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creator_id).toBe("creator-1");
    expect(body.min_amount_usdc).toBe(1);
    expect(body.animation).toBe("confetti");
    expect(body.duration_seconds).toBe(5);
    expect(body.sound_url).toBeUndefined();
  });

  it("GET 400 when creator_id is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  // ── PUT ───────────────────────────────────────────────────────────────────

  it("PUT updates min_amount_usdc", async () => {
    const res = await PUT(makePut({ creator_id: "creator-1", min_amount_usdc: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.min_amount_usdc).toBe(5);
  });

  it("PUT updates animation to fireworks", async () => {
    const res = await PUT(makePut({ creator_id: "creator-1", animation: "fireworks" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.animation).toBe("fireworks");
  });

  it("PUT sets sound_url", async () => {
    const res = await PUT(makePut({ creator_id: "creator-1", sound_url: "https://example.com/alert.mp3" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sound_url).toBe("https://example.com/alert.mp3");
  });

  it("PUT updates duration_seconds within [1, 30]", async () => {
    const res = await PUT(makePut({ creator_id: "creator-1", duration_seconds: 15 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duration_seconds).toBe(15);
  });

  it("PUT persists; subsequent GET returns updated config", async () => {
    await PUT(makePut({ creator_id: "creator-2", min_amount_usdc: 10, animation: "none", duration_seconds: 8 }));
    const res = await GET(makeGet("creator-2"));
    const body = await res.json();
    expect(body.min_amount_usdc).toBe(10);
    expect(body.animation).toBe("none");
    expect(body.duration_seconds).toBe(8);
  });

  // ── validation ────────────────────────────────────────────────────────────

  it("PUT 400 when duration_seconds < 1", async () => {
    const res = await PUT(makePut({ creator_id: "c", duration_seconds: 0 }));
    expect(res.status).toBe(400);
  });

  it("PUT 400 when duration_seconds > 30", async () => {
    const res = await PUT(makePut({ creator_id: "c", duration_seconds: 31 }));
    expect(res.status).toBe(400);
  });

  it("PUT 400 for invalid animation value", async () => {
    const res = await PUT(makePut({ creator_id: "c", animation: "sparkles" }));
    expect(res.status).toBe(400);
  });

  it("PUT 400 when creator_id is missing", async () => {
    const res = await PUT(makePut({ min_amount_usdc: 5 }));
    expect(res.status).toBe(400);
  });

  it("PUT 400 on invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/tip-alert", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "bad-json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
