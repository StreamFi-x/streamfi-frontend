/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../clamp-normalize/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/clamp-normalize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/clamp-normalize", () => {
  it("clamps values below the range", async () => {
    const res = await POST(makeReq({ value: -5, min: 0, max: 10 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ clamped: 0 });
  });

  it("keeps values within the range", async () => {
    const res = await POST(makeReq({ value: 6, min: 0, max: 10 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ clamped: 6 });
  });

  it("clamps values above the range", async () => {
    const res = await POST(makeReq({ value: 15, min: 0, max: 10, normalize: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ clamped: 10, normalized: 1 });
  });

  it("normalizes clamped values to the 0-1 range", async () => {
    const res = await POST(makeReq({ value: 5, min: 0, max: 10, normalize: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ clamped: 5, normalized: 0.5 });
  });

  it("rejects ranges where min is greater than max", async () => {
    const res = await POST(makeReq({ value: 5, min: 10, max: 0 }));

    expect(res.status).toBe(400);
  });
});
