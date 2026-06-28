/**
 * @jest-environment node
 *
 * Tests for:
 *   GET  /api/routes-f/multi-asset-tips
 *   POST /api/routes-f/multi-asset-tips  (convert)
 *
 * Static rates used (from rates.ts):
 *   XLM  = $0.11
 *   USDC = $1.00
 *   BTC  = $67,000
 *   ETH  = $3,500
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../multi-asset-tips/route";
import { ASSETS, convert, crossRate } from "../multi-asset-tips/rates";
import type { AssetSymbol } from "../multi-asset-tips/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/multi-asset-tips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET — asset catalog
// ---------------------------------------------------------------------------

describe("GET /api/routes-f/multi-asset-tips", () => {
  it("returns 200 with an assets array", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.assets)).toBe(true);
    expect(body.assets.length).toBeGreaterThan(0);
  });

  it("includes XLM, USDC, BTC, and ETH", async () => {
    const res = await GET();
    const { assets } = await res.json();
    const symbols: string[] = assets.map((a: { symbol: string }) => a.symbol);
    expect(symbols).toContain("XLM");
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("BTC");
    expect(symbols).toContain("ETH");
  });

  it("each asset has symbol, usd_rate, and min_tip", async () => {
    const res = await GET();
    const { assets } = await res.json();
    for (const a of assets) {
      expect(typeof a.symbol).toBe("string");
      expect(typeof a.usd_rate).toBe("number");
      expect(a.usd_rate).toBeGreaterThan(0);
      expect(typeof a.min_tip).toBe("number");
      expect(a.min_tip).toBeGreaterThan(0);
    }
  });

  it("USDC usd_rate is exactly 1", async () => {
    const res = await GET();
    const { assets } = await res.json();
    const usdc = assets.find((a: { symbol: string }) => a.symbol === "USDC");
    expect(usdc.usd_rate).toBe(1);
  });

  it("BTC usd_rate is higher than ETH usd_rate", async () => {
    const res = await GET();
    const { assets } = await res.json();
    const btc = assets.find((a: { symbol: string }) => a.symbol === "BTC");
    const eth = assets.find((a: { symbol: string }) => a.symbol === "ETH");
    expect(btc.usd_rate).toBeGreaterThan(eth.usd_rate);
  });

  it("assets count matches the rates catalog", async () => {
    const res = await GET();
    const { assets } = await res.json();
    expect(assets.length).toBe(ASSETS.length);
  });
});

// ---------------------------------------------------------------------------
// POST — validation
// ---------------------------------------------------------------------------

describe("POST /api/routes-f/multi-asset-tips — validation", () => {
  it("returns 400 when body is missing required fields", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when amount is 0", async () => {
    const res = await POST(makePost({ amount: 0, from: "XLM", to: "USDC" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is negative", async () => {
    const res = await POST(makePost({ amount: -5, from: "XLM", to: "USDC" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when from is an unsupported symbol", async () => {
    const res = await POST(makePost({ amount: 10, from: "DOGE", to: "USDC" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when to is an unsupported symbol", async () => {
    const res = await POST(makePost({ amount: 10, from: "XLM", to: "SOL" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is a string", async () => {
    const res = await POST(makePost({ amount: "ten", from: "XLM", to: "USDC" }));
    expect(res.status).toBe(400);
  });

  it("returns 422 when from === to", async () => {
    const res = await POST(makePost({ amount: 10, from: "XLM", to: "XLM" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/different/i);
  });
});

// ---------------------------------------------------------------------------
// POST — conversion math
// ---------------------------------------------------------------------------

describe("POST /api/routes-f/multi-asset-tips — conversion math", () => {
  it("XLM → USDC: 100 XLM = $11 USDC (0.11 * 100)", async () => {
    const res = await POST(makePost({ amount: 100, from: "XLM", to: "USDC" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted).toBeCloseTo(11, 6);
    expect(body.from).toBe("XLM");
    expect(body.to).toBe("USDC");
    expect(body.amount).toBe(100);
  });

  it("USDC → XLM: $1 USDC = ~9.09 XLM (1 / 0.11)", async () => {
    const res = await POST(makePost({ amount: 1, from: "USDC", to: "XLM" }));
    expect(res.status).toBe(200);
    const { converted } = await res.json();
    expect(converted).toBeCloseTo(1 / 0.11, 4);
  });

  it("USDC → BTC: $67000 USDC = 1 BTC", async () => {
    const res = await POST(makePost({ amount: 67000, from: "USDC", to: "BTC" }));
    expect(res.status).toBe(200);
    const { converted } = await res.json();
    expect(converted).toBeCloseTo(1, 6);
  });

  it("BTC → ETH: 1 BTC = 67000/3500 ETH", async () => {
    const res = await POST(makePost({ amount: 1, from: "BTC", to: "ETH" }));
    expect(res.status).toBe(200);
    const { converted, rate } = await res.json();
    const expected = 67000 / 3500;
    expect(converted).toBeCloseTo(expected, 4);
    expect(rate).toBeCloseTo(expected, 4);
  });

  it("ETH → USDC: 1 ETH = $3500 USDC", async () => {
    const res = await POST(makePost({ amount: 1, from: "ETH", to: "USDC" }));
    expect(res.status).toBe(200);
    const { converted } = await res.json();
    expect(converted).toBeCloseTo(3500, 4);
  });

  it("XLM → BTC: 1000 XLM = (1000 * 0.11) / 67000 BTC", async () => {
    const res = await POST(makePost({ amount: 1000, from: "XLM", to: "BTC" }));
    expect(res.status).toBe(200);
    const { converted } = await res.json();
    expect(converted).toBeCloseTo((1000 * 0.11) / 67000, 7);
  });

  it("response shape includes from, to, amount, converted, rate", async () => {
    const res = await POST(makePost({ amount: 50, from: "XLM", to: "USDC" }));
    const body = await res.json();
    expect(typeof body.from).toBe("string");
    expect(typeof body.to).toBe("string");
    expect(typeof body.amount).toBe("number");
    expect(typeof body.converted).toBe("number");
    expect(typeof body.rate).toBe("number");
  });

  it("rate equals convert(1, from, to)", async () => {
    const res = await POST(makePost({ amount: 250, from: "ETH", to: "XLM" }));
    const { rate } = await res.json();
    expect(rate).toBeCloseTo(convert(1, "ETH", "XLM"), 6);
  });
});

// ---------------------------------------------------------------------------
// rates.ts unit tests
// ---------------------------------------------------------------------------

describe("rates.ts — convert() helper", () => {
  it("convert is symmetric: convert(convert(x, A, B), B, A) ≈ x", () => {
    const pairs: [AssetSymbol, AssetSymbol][] = [
      ["XLM", "USDC"],
      ["BTC", "ETH"],
      ["ETH", "XLM"],
    ];
    for (const [a, b] of pairs) {
      const there = convert(100, a, b);
      const back = convert(there, b, a);
      expect(back).toBeCloseTo(100, 4);
    }
  });

  it("crossRate(A, B) * crossRate(B, A) ≈ 1", () => {
    const pairs: [AssetSymbol, AssetSymbol][] = [
      ["XLM", "USDC"],
      ["BTC", "ETH"],
    ];
    for (const [a, b] of pairs) {
      const product = crossRate(a, b) * crossRate(b, a);
      expect(product).toBeCloseTo(1, 4);
    }
  });
});
