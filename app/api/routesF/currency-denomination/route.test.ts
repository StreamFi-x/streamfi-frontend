import { NextRequest } from "next/server";
import { POST } from "./route";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/currency-denomination", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routesF/currency-denomination", () => {
  // ── validation ────────────────────────────────────────────────────────────

  it("returns 400 when amount is missing", async () => {
    const res = await POST(makePost({ currency: "USD" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is negative", async () => {
    const res = await POST(makePost({ amount: -5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported currency", async () => {
    const res = await POST(makePost({ amount: 10, currency: "GBP" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/currency-denomination", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── USD minimal-piece breakdown ───────────────────────────────────────────

  it("breaks $1.00 into 1 dollar bill (fewest pieces)", async () => {
    const res = await POST(makePost({ amount: 1.0, currency: "USD" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total_pieces).toBe(1);
    expect(data.breakdown[0]).toMatchObject({ denomination: 1, count: 1 });
  });

  it("breaks $0.41 into fewest USD coins", async () => {
    const res = await POST(makePost({ amount: 0.41, currency: "USD" }));
    const data = await res.json();
    // quarter(1) + dime(1) + nickel(1) + penny(1) = 4 pieces
    expect(data.total_pieces).toBe(4);
  });

  it("breaks $126.37 correctly with USD", async () => {
    const res = await POST(makePost({ amount: 126.37, currency: "USD" }));
    const data = await res.json();
    expect(data.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ denomination: 100, count: 1 }),
        expect.objectContaining({ denomination: 20, count: 1 }),
        expect.objectContaining({ denomination: 5, count: 1 }),
        expect.objectContaining({ denomination: 1, count: 1 }),
        expect.objectContaining({ denomination: 0.25, count: 1 }),
        expect.objectContaining({ denomination: 0.10, count: 1 }),
        expect.objectContaining({ denomination: 0.01, count: 2 }),
      ])
    );
  });

  // ── EUR ───────────────────────────────────────────────────────────────────

  it("breaks EUR amount into fewest pieces", async () => {
    const res = await POST(makePost({ amount: 7.50, currency: "EUR" }));
    const data = await res.json();
    // 5 euro note + 2 euro coin + 50 cent coin = 3 pieces
    expect(data.total_pieces).toBe(3);
  });

  // ── NGN ───────────────────────────────────────────────────────────────────

  it("breaks NGN amount into fewest pieces", async () => {
    const res = await POST(makePost({ amount: 1750, currency: "NGN" }));
    const data = await res.json();
    // 1000 + 500 + 200 + 50 = 4 pieces
    expect(data.total_pieces).toBe(4);
  });

  // ── zero ──────────────────────────────────────────────────────────────────

  it("returns empty breakdown for zero amount", async () => {
    const res = await POST(makePost({ amount: 0, currency: "USD" }));
    const data = await res.json();
    expect(data.total_pieces).toBe(0);
    expect(data.breakdown).toHaveLength(0);
  });

  // ── defaults to USD ───────────────────────────────────────────────────────

  it("defaults to USD when currency is omitted", async () => {
    const res = await POST(makePost({ amount: 1.0 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.breakdown[0]).toMatchObject({ denomination: 1 });
  });
});
