/**
 * @jest-environment node
 */
import { POST } from "../triangle/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/triangle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/triangle", () => {
  // --- Equilateral triangle ---
  it("calculates equilateral triangle from sides", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [5, 5, 5] }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.is_valid_triangle).toBe(true);
    expect(d.type).toBe("equilateral");
    expect(d.angle_type).toBe("acute");
    expect(d.angles_deg[0]).toBeCloseTo(60, 1);
    expect(d.angles_deg[1]).toBeCloseTo(60, 1);
    expect(d.angles_deg[2]).toBeCloseTo(60, 1);
    expect(d.perimeter).toBe(15);
    expect(d.area).toBeCloseTo(10.8253, 2);
  });

  // --- Isosceles triangle ---
  it("calculates isosceles triangle from sides", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [5, 5, 8] }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.type).toBe("isosceles");
  });

  // --- Scalene triangle ---
  it("calculates scalene triangle from sides", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [3, 4, 6] }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.type).toBe("scalene");
  });

  // --- Right triangle (3-4-5) ---
  it("detects right triangle (3-4-5)", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [3, 4, 5] }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.is_valid_triangle).toBe(true);
    expect(d.angle_type).toBe("right");
    expect(d.type).toBe("scalene");
    expect(d.area).toBe(6);
    expect(d.perimeter).toBe(12);
  });

  // --- Obtuse triangle ---
  it("detects obtuse triangle", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [2, 3, 4] }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.angle_type).toBe("obtuse");
  });

  // --- Vertices mode ---
  it("calculates triangle from vertices", async () => {
    const res = await POST(
      makeReq({
        mode: "vertices",
        vertices: [
          [0, 0],
          [4, 0],
          [0, 3],
        ],
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.is_valid_triangle).toBe(true);
    expect(d.area).toBe(6);
    expect(d.angle_type).toBe("right");
    expect(d.centroid).toBeDefined();
    expect(d.centroid.x).toBeCloseTo(1.3333, 2);
    expect(d.centroid.y).toBeCloseTo(1, 2);
  });

  // --- Invalid triangle (sides don't satisfy triangle inequality) ---
  it("rejects invalid triangle inequality", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [1, 2, 10] }));
    expect(res.status).toBe(400);
  });

  // --- Degenerate triangle (collinear points) ---
  it("rejects degenerate triangle (collinear)", async () => {
    const res = await POST(
      makeReq({
        mode: "vertices",
        vertices: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  // --- Invalid mode ---
  it("rejects invalid mode", async () => {
    const res = await POST(makeReq({ mode: "invalid", sides: [3, 4, 5] }));
    expect(res.status).toBe(400);
  });

  // --- Missing sides ---
  it("rejects missing sides in sides mode", async () => {
    const res = await POST(makeReq({ mode: "sides" }));
    expect(res.status).toBe(400);
  });

  // --- Negative side ---
  it("rejects negative sides", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [-1, 3, 4] }));
    expect(res.status).toBe(400);
  });

  // --- Invalid JSON ---
  it("rejects invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/triangle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // --- Circumradius is returned ---
  it("returns circumradius", async () => {
    const res = await POST(makeReq({ mode: "sides", sides: [3, 4, 5] }));
    const d = await res.json();
    expect(d.circumradius).toBe(2.5);
  });
});
