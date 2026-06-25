/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, rings } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/stream-heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE = {
  stream_id: "stream-abc-123",
  bitrate_kbps: 4000,
  fps: 30,
  resolution: "1920x1080",
  dropped_frames: 0,
};

describe("POST /api/routes-f/stream-heartbeat", () => {
  beforeEach(() => rings.clear());

  // ── health tiers ──────────────────────────────────────────────────────────

  it('returns health "ok" for healthy stream', async () => {
    const res = await POST(makeReq(BASE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.health).toBe("ok");
    expect(body.recommendations).toEqual([]);
  });

  it('returns health "degraded" when bitrate is below 1500 kbps', async () => {
    const res = await POST(makeReq({ ...BASE, bitrate_kbps: 1000 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.health).toBe("degraded");
    expect(body.recommendations.length).toBeGreaterThan(0);
  });

  it('returns health "critical" when bitrate is below 500 kbps', async () => {
    const res = await POST(makeReq({ ...BASE, bitrate_kbps: 300 }));
    const body = await res.json();
    expect(body.health).toBe("critical");
    expect(body.recommendations.some((r: string) => /bitrate/i.test(r))).toBe(true);
  });

  it('returns health "degraded" when drop ratio is >= 3%', async () => {
    // fps=97 dropped=3 → ratio = 3/100 = 3%
    const res = await POST(makeReq({ ...BASE, fps: 97, dropped_frames: 3 }));
    const body = await res.json();
    expect(body.health).toBe("degraded");
  });

  it('returns health "critical" when drop ratio is >= 10%', async () => {
    // fps=90 dropped=10 → ratio = 10/100 = 10%
    const res = await POST(makeReq({ ...BASE, fps: 90, dropped_frames: 10 }));
    const body = await res.json();
    expect(body.health).toBe("critical");
  });

  // ── ring buffer ───────────────────────────────────────────────────────────

  it("stores samples in the ring buffer", async () => {
    await POST(makeReq(BASE));
    const buf = rings.get(BASE.stream_id)!;
    expect(buf).toHaveLength(1);
    expect(buf[0].bitrate_kbps).toBe(4000);
  });

  it("caps ring buffer at 60 samples", async () => {
    for (let i = 0; i < 65; i++) {
      await POST(makeReq({ ...BASE, bitrate_kbps: i * 100 }));
    }
    const buf = rings.get(BASE.stream_id)!;
    expect(buf).toHaveLength(60);
    // oldest sample dropped — first should be from iteration 5 (bitrate 500)
    expect(buf[0].bitrate_kbps).toBe(500);
  });

  it("keeps separate buffers per stream", async () => {
    await POST(makeReq({ ...BASE, stream_id: "stream-1" }));
    await POST(makeReq({ ...BASE, stream_id: "stream-2" }));
    expect(rings.get("stream-1")).toHaveLength(1);
    expect(rings.get("stream-2")).toHaveLength(1);
  });

  // ── dropped_frames optional ───────────────────────────────────────────────

  it("defaults dropped_frames to 0 when omitted", async () => {
    const { dropped_frames: _, ...noDrops } = BASE;
    const res = await POST(makeReq(noDrops));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.health).toBe("ok");
  });

  // ── validation ────────────────────────────────────────────────────────────

  it("400 when stream_id is missing", async () => {
    const { stream_id: _, ...rest } = BASE;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
  });

  it("400 when bitrate_kbps is missing", async () => {
    const { bitrate_kbps: _, ...rest } = BASE;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
  });

  it("400 when fps is missing", async () => {
    const { fps: _, ...rest } = BASE;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
  });

  it("400 when resolution is missing", async () => {
    const { resolution: _, ...rest } = BASE;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
  });

  it("400 on invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
