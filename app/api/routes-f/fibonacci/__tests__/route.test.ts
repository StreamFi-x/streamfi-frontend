import { NextRequest } from "next/server";
import { POST, fibNth } from "../route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/fibonacci", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("fibNth", () => {
  it("matches known values", () => {
    expect(fibNth(1)).toBe(BigInt(1));
    expect(fibNth(2)).toBe(BigInt(1));
    expect(fibNth(10)).toBe(BigInt(55));
    expect(fibNth(20)).toBe(BigInt(6765));
  });

  it("uses BigInt-safe outputs beyond precision boundary", () => {
    expect(fibNth(78)).toBe(BigInt("8944394323791464"));
    expect(fibNth(79)).toBe(BigInt("14472334024676221"));
  });
});

describe("POST /api/routes-f/fibonacci", () => {
  it("returns first n sequence in count mode", async () => {
    const res = await POST(req({ mode: "count", n: 7, format: "array" }));
    expect(res.status).toBe(200);
    expect((await res.json()).sequence).toEqual([
      "1",
      "1",
      "2",
      "3",
      "5",
      "8",
      "13",
    ]);
  });

  it("returns nth value in count mode", async () => {
    const res = await POST(req({ mode: "count", n: 10, format: "nth" }));
    expect(res.status).toBe(200);
    expect((await res.json()).value).toBe("55");
  });

  it("returns all values <= max in until mode", async () => {
    const res = await POST(req({ mode: "until", max: "34", format: "array" }));
    expect(res.status).toBe(200);
    expect((await res.json()).sequence).toEqual([
      "1",
      "1",
      "2",
      "3",
      "5",
      "8",
      "13",
      "21",
      "34",
    ]);
  });

  it("validates input bounds", async () => {
    const resN = await POST(req({ mode: "count", n: 0 }));
    const resMax = await POST(req({ mode: "until", max: 0 }));
    expect(resN.status).toBe(400);
    expect(resMax.status).toBe(400);
  });
});
