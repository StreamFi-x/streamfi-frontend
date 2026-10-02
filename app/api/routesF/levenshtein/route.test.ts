import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/levenshtein", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/levenshtein", () => {
  it("computes the known kitten/sitting distance", async () => {
    const res = await POST(makeReq({ a: "kitten", b: "sitting" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.distance).toBe(3);
    expect(data.ratio).toBeCloseTo(1 - 3 / 7, 10);
  });

  it("returns a perfect similarity ratio for identical strings", async () => {
    const res = await POST(makeReq({ a: "streamfi", b: "streamfi" }));
    const data = await res.json();

    expect(data.distance).toBe(0);
    expect(data.ratio).toBe(1);
  });

  it("caps inputs at 10KB", async () => {
    const oversized = "a".repeat(10 * 1024 + 1);
    const res = await POST(makeReq({ a: oversized, b: "b" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Inputs must not exceed 10KB each.",
    });
  });

  it("rejects invalid bodies", async () => {
    const res = await POST(makeReq({ a: "hello" }));

    expect(res.status).toBe(400);
  });
});
