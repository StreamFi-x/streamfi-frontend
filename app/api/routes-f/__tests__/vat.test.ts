/**
 * @jest-environment node
 */
import { POST, GET } from "../vat/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/vat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/vat", () => {
  describe("POST – add mode (default)", () => {
    it("adds tax to pre-tax amount", async () => {
      const res = await POST(makeReq({ amount: 100, rate: 20 }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.net).toBe(100);
      expect(data.tax).toBe(20);
      expect(data.gross).toBe(120);
      expect(data.mode).toBe("add");
    });

    it("handles 0% rate", async () => {
      const res = await POST(makeReq({ amount: 50, rate: 0, mode: "add" }));
      const data = await res.json();
      expect(data.tax).toBe(0);
      expect(data.gross).toBe(50);
    });

    it("rounds to 2 decimal places", async () => {
      const res = await POST(makeReq({ amount: 99.99, rate: 7.5, mode: "add" }));
      const data = await res.json();
      expect(data.tax).toBe(7.5);
      expect(data.gross).toBe(107.49);
    });
  });

  describe("POST – extract mode", () => {
    it("extracts tax from gross amount", async () => {
      const res = await POST(makeReq({ amount: 120, rate: 20, mode: "extract" }));
      const data = await res.json();
      expect(data.gross).toBe(120);
      expect(data.net).toBe(100);
      expect(data.tax).toBe(20);
      expect(data.mode).toBe("extract");
    });

    it("round-trip: add then extract returns same net", async () => {
      const addRes = await POST(makeReq({ amount: 250, rate: 21, mode: "add" }));
      const { gross } = await addRes.json();
      const extractRes = await POST(makeReq({ amount: gross, rate: 21, mode: "extract" }));
      const { net } = await extractRes.json();
      expect(net).toBe(250);
    });
  });

  describe("POST – validation", () => {
    it("rejects negative amount", async () => {
      const res = await POST(makeReq({ amount: -10, rate: 20 }));
      expect(res.status).toBe(400);
    });

    it("rejects rate > 100", async () => {
      const res = await POST(makeReq({ amount: 100, rate: 101 }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid mode", async () => {
      const res = await POST(makeReq({ amount: 100, rate: 20, mode: "unknown" }));
      expect(res.status).toBe(400);
    });

    it("rejects missing amount", async () => {
      const res = await POST(makeReq({ rate: 20 }));
      expect(res.status).toBe(400);
    });
  });

  describe("GET – reference rates", () => {
    it("returns a list of VAT rates", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/vat");
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.rates)).toBe(true);
      expect(data.rates.length).toBeGreaterThan(10);
    });
  });
});
