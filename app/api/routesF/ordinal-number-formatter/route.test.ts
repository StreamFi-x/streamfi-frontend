/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, toOrdinal } from "./route";

function makeReq(n: string) {
  return new NextRequest(
    `http://localhost/api/routesF/ordinal-number-formatter?n=${n}`
  );
}

describe("toOrdinal", () => {
  it("handles st suffix (1, 21, 31, 101)", () => {
    expect(toOrdinal(1)).toEqual({ ordinal: "1st", suffix: "st" });
    expect(toOrdinal(21)).toEqual({ ordinal: "21st", suffix: "st" });
    expect(toOrdinal(31)).toEqual({ ordinal: "31st", suffix: "st" });
    expect(toOrdinal(101)).toEqual({ ordinal: "101st", suffix: "st" });
  });

  it("handles nd suffix (2, 22, 102)", () => {
    expect(toOrdinal(2)).toEqual({ ordinal: "2nd", suffix: "nd" });
    expect(toOrdinal(22)).toEqual({ ordinal: "22nd", suffix: "nd" });
    expect(toOrdinal(102)).toEqual({ ordinal: "102nd", suffix: "nd" });
  });

  it("handles rd suffix (3, 23, 103)", () => {
    expect(toOrdinal(3)).toEqual({ ordinal: "3rd", suffix: "rd" });
    expect(toOrdinal(23)).toEqual({ ordinal: "23rd", suffix: "rd" });
    expect(toOrdinal(103)).toEqual({ ordinal: "103rd", suffix: "rd" });
  });

  it("handles th suffix for all other cases", () => {
    expect(toOrdinal(4)).toEqual({ ordinal: "4th", suffix: "th" });
    expect(toOrdinal(10)).toEqual({ ordinal: "10th", suffix: "th" });
    expect(toOrdinal(20)).toEqual({ ordinal: "20th", suffix: "th" });
    expect(toOrdinal(100)).toEqual({ ordinal: "100th", suffix: "th" });
  });

  it("handles teen special cases (11, 12, 13 are always th)", () => {
    expect(toOrdinal(11)).toEqual({ ordinal: "11th", suffix: "th" });
    expect(toOrdinal(12)).toEqual({ ordinal: "12th", suffix: "th" });
    expect(toOrdinal(13)).toEqual({ ordinal: "13th", suffix: "th" });
    expect(toOrdinal(111)).toEqual({ ordinal: "111th", suffix: "th" });
    expect(toOrdinal(112)).toEqual({ ordinal: "112th", suffix: "th" });
    expect(toOrdinal(113)).toEqual({ ordinal: "113th", suffix: "th" });
  });

  it("handles negatives correctly", () => {
    expect(toOrdinal(-1)).toEqual({ ordinal: "-1st", suffix: "st" });
    expect(toOrdinal(-11)).toEqual({ ordinal: "-11th", suffix: "th" });
    expect(toOrdinal(-21)).toEqual({ ordinal: "-21st", suffix: "st" });
    expect(toOrdinal(-13)).toEqual({ ordinal: "-13th", suffix: "th" });
  });

  it("handles zero", () => {
    expect(toOrdinal(0)).toEqual({ ordinal: "0th", suffix: "th" });
  });

  it("handles large numbers", () => {
    expect(toOrdinal(1001)).toEqual({ ordinal: "1001st", suffix: "st" });
    expect(toOrdinal(10011)).toEqual({ ordinal: "10011th", suffix: "th" });
    expect(toOrdinal(10021)).toEqual({ ordinal: "10021st", suffix: "st" });
  });
});

describe("GET /api/routesF/ordinal-number-formatter", () => {
  it("returns ordinal for n=21", async () => {
    const res = await GET(makeReq("21"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ordinal: "21st", suffix: "st" });
  });

  it("returns ordinal for n=11 (teen special case)", async () => {
    const res = await GET(makeReq("11"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ordinal: "11th", suffix: "th" });
  });

  it("returns ordinal for negative n=-13", async () => {
    const res = await GET(makeReq("-13"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ordinal: "-13th", suffix: "th" });
  });

  it("returns 400 when n is missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/routesF/ordinal-number-formatter"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/i);
  });

  it("returns 400 for non-integer n", async () => {
    const res = await GET(makeReq("3.14"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric n", async () => {
    const res = await GET(makeReq("abc"));
    expect(res.status).toBe(400);
  });
});
