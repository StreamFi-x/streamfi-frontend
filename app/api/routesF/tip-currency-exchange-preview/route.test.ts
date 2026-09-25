import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/tip-currency-exchange-preview", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Tip Currency Exchange Preview API", () => {
  // Every asset x currency combination, with the expected static rate.
  const cases: Array<{
    asset: "XLM" | "USDC";
    fiat_currency: "USD" | "EUR" | "NGN";
    amount: number;
    rate: number;
  }> = [
    { asset: "XLM", fiat_currency: "USD", amount: 100, rate: 0.12 },
    { asset: "XLM", fiat_currency: "EUR", amount: 100, rate: 0.11 },
    { asset: "XLM", fiat_currency: "NGN", amount: 10, rate: 186.0 },
    { asset: "USDC", fiat_currency: "USD", amount: 25, rate: 1.0 },
    { asset: "USDC", fiat_currency: "EUR", amount: 25, rate: 0.92 },
    { asset: "USDC", fiat_currency: "NGN", amount: 2, rate: 1550.0 },
  ];

  it.each(cases)(
    "previews $amount $asset in $fiat_currency",
    async ({ asset, fiat_currency, amount, rate }) => {
      const res = await POST(makeReq({ asset, amount, fiat_currency }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.rate_used).toBe(rate);
      expect(data.fiat_estimate).toBeCloseTo(amount * rate, 2);
    }
  );

  it("rounds the fiat estimate to 2 decimal places", async () => {
    // 3.333 XLM * 0.12 = 0.39996 -> 0.40
    const res = await POST(makeReq({ asset: "XLM", amount: 3.333, fiat_currency: "USD" }));
    const data = await res.json();

    expect(data.fiat_estimate).toBe(0.4);
  });

  it("rejects an unsupported asset", async () => {
    const res = await POST(makeReq({ asset: "BTC", amount: 1, fiat_currency: "USD" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported fiat currency", async () => {
    const res = await POST(makeReq({ asset: "XLM", amount: 1, fiat_currency: "GBP" }));
    expect(res.status).toBe(400);
  });

  it("rejects zero and negative amounts", async () => {
    for (const amount of [0, -5]) {
      const res = await POST(makeReq({ asset: "USDC", amount, fiat_currency: "USD" }));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a non-numeric amount", async () => {
    const res = await POST(makeReq({ asset: "USDC", amount: "ten", fiat_currency: "USD" }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routesF/tip-currency-exchange-preview", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
