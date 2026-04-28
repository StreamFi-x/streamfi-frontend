/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../currency-format/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/currency-format", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/currency-format", () => {
  it("formats USD in default en-US locale", async () => {
    const res = await POST(makeReq({ amount: 1234.56, currency: "usd" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.currency).toBe("USD");
    expect(data.code).toBe("USD");
    expect(data.symbol).toBe("$");
    expect(data.locale_used).toMatch(/^en-US/);
    expect(data.formatted).toBe("$1,234.56");
  });

  it("formats EUR in de-DE locale", async () => {
    const res = await POST(makeReq({ amount: 1234.56, currency: "EUR", locale: "de-DE" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.currency).toBe("EUR");
    expect(data.locale_used).toMatch(/^de-DE/);
    expect(data.formatted).toContain("1.234,56");
    expect(data.formatted).toContain("€");
  });

  it("formats JPY with no decimals by default", async () => {
    const res = await POST(makeReq({ amount: 1234.56, currency: "JPY", locale: "ja-JP" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.currency).toBe("JPY");
    expect(data.locale_used).toMatch(/^ja-JP/);
    expect(data.formatted).toContain("￥");
    expect(data.formatted).not.toContain(".");
    expect(data.formatted).not.toContain(",");
  });

  it("formats NGN in en-NG locale", async () => {
    const res = await POST(makeReq({ amount: 50000, currency: "NGN", locale: "en-NG" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.currency).toBe("NGN");
    expect(data.locale_used).toMatch(/^en-NG/);
    expect(data.formatted).toContain("₦");
    expect(data.formatted).toContain("50,000.00");
  });

  it("formats INR with Indian numbering separators", async () => {
    const res = await POST(makeReq({ amount: 1234567.89, currency: "INR", locale: "en-IN" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.currency).toBe("INR");
    expect(data.locale_used).toMatch(/^en-IN/);
    expect(data.formatted).toContain("₹");
    expect(data.formatted).toContain("12,34,567.89");
  });

  it("respects explicit decimals override", async () => {
    const res = await POST(makeReq({ amount: 12.3, currency: "USD", decimals: 3 }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.formatted).toBe("$12.300");
  });

  it("returns 400 for unsupported currency code", async () => {
    const res = await POST(makeReq({ amount: 100, currency: "ZZZ" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid decimals value", async () => {
    const res = await POST(makeReq({ amount: 100, currency: "USD", decimals: 2.5 }));
    expect(res.status).toBe(400);
  });
});
