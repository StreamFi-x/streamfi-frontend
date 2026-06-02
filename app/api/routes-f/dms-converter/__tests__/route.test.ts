/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/dms-converter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/dms-converter", () => {
  describe("to_decimal mode", () => {
    it("converts DMS latitude to decimal (North)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 40, minutes: 26, seconds: 46, direction: "N" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.decimal).toBeCloseTo(40.446111, 5);
    });

    it("converts DMS latitude to decimal (South)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 33, minutes: 51, seconds: 30, direction: "S" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.decimal).toBeCloseTo(-33.858333, 5);
    });

    it("converts DMS longitude to decimal (East)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 151, minutes: 12, seconds: 30, direction: "E" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.decimal).toBeCloseTo(151.208333, 5);
    });

    it("converts DMS longitude to decimal (West)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 74, minutes: 0, seconds: 21, direction: "W" },
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.decimal).toBeCloseTo(-74.005833, 5);
    });

    it("rejects invalid direction or coordinate types", async () => {
      // Invalid direction string
      let res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 40, minutes: 26, seconds: 46, direction: "X" },
        })
      );
      expect(res.status).toBe(400);

      // Latitude with longitude direction
      res = await POST(
        makeReq({
          mode: "to_decimal",
          type: "lat",
          dms: { degrees: 40, minutes: 26, seconds: 46, direction: "W" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid minutes/seconds ranges", async () => {
      let res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 40, minutes: 61, seconds: 46, direction: "N" },
        })
      );
      expect(res.status).toBe(400);

      res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 40, minutes: 26, seconds: -1, direction: "N" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects latitude out of bounds (> 90)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_decimal",
          dms: { degrees: 95, minutes: 0, seconds: 0, direction: "N" },
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("to_dms mode", () => {
    it("converts decimal latitude to DMS (North)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_dms",
          decimal: 40.446111,
          type: "lat",
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.degrees).toBe(40);
      expect(body.minutes).toBe(26);
      expect(body.seconds).toBeCloseTo(46.0, 1);
      expect(body.direction).toBe("N");
    });

    it("converts decimal latitude to DMS (South)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_dms",
          decimal: -33.858333,
          type: "lat",
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.degrees).toBe(33);
      expect(body.minutes).toBe(51);
      expect(body.seconds).toBeCloseTo(30.0, 1);
      expect(body.direction).toBe("S");
    });

    it("converts decimal longitude to DMS (East)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_dms",
          decimal: 151.208333,
          type: "lng",
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.degrees).toBe(151);
      expect(body.minutes).toBe(12);
      expect(body.seconds).toBeCloseTo(30.0, 1);
      expect(body.direction).toBe("E");
    });

    it("handles rollover precision edge cases", async () => {
      // 40.99999999 should round up and not cause seconds >= 60
      const res = await POST(
        makeReq({
          mode: "to_dms",
          decimal: 40.99999999,
          type: "lat",
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.degrees).toBe(41);
      expect(body.minutes).toBe(0);
      expect(body.seconds).toBe(0);
    });

    it("rejects latitude out of bounds (> 90)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_dms",
          decimal: 95.0,
          type: "lat",
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects longitude out of bounds (> 180)", async () => {
      const res = await POST(
        makeReq({
          mode: "to_dms",
          decimal: -185.0,
          type: "lng",
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
