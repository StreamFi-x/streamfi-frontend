/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/distance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/distance", () => {
  it("calculates known city-pair distance (NYC to LA)", async () => {
    const res = await POST(
      makeReq({
        from: [40.7128, -74.006],
        to: [34.0522, -118.2437],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total_km).toBeCloseTo(3935.746, 0);
    expect(body.total_mi).toBeCloseTo(2445.559, 0);
    expect(body.segments).toHaveLength(1);
  });

  it("sums segments when waypoints are provided", async () => {
    const res = await POST(
      makeReq({
        from: [0, 0],
        waypoints: [[0, 1], [1, 1]],
        to: [1, 2],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.segments).toHaveLength(3);
    expect(body.total_km).toBeCloseTo(333.568, 0);
  });

  it("rejects out-of-range coordinates", async () => {
    const res = await POST(
      makeReq({
        from: [91, 0],
        to: [10, 10],
      }),
    );
    expect(res.status).toBe(400);
  });
});
