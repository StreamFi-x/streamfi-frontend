/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../interpolation/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/interpolation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/interpolation", () => {
  it("returns the midpoint between two values in lerp mode", async () => {
    const res = await POST(makeReq({ mode: "lerp", a: 10, b: 20, t: 0.5 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ result: 15 });
  });

  it("maps a value from one range to another", async () => {
    const res = await POST(
      makeReq({ mode: "map", value: 5, in_min: 0, in_max: 10, out_min: 0, out_max: 100 })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ result: 50 });
  });

  it("maps reversed output ranges", async () => {
    const res = await POST(
      makeReq({ mode: "map", value: 25, in_min: 0, in_max: 100, out_min: 1, out_max: 0 })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ result: 0.75 });
  });

  it("rejects unknown modes", async () => {
    const res = await POST(makeReq({ mode: "scale", value: 5 }));

    expect(res.status).toBe(400);
  });

  it("rejects zero-width input ranges in map mode", async () => {
    const res = await POST(
      makeReq({ mode: "map", value: 5, in_min: 1, in_max: 1, out_min: 0, out_max: 10 })
    );

    expect(res.status).toBe(400);
  });
});
