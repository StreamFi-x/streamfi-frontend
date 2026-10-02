/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { determinant } from "./lu";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/determinant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/determinant", () => {
  it("computes the determinant of a 2x2 matrix", async () => {
    const res = await POST(makeReq({ matrix: [[4, 3], [6, 3]] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.determinant).toBe(-6);
  });

  it("computes the determinant of a 3x3 matrix", async () => {
    const res = await POST(
      makeReq({
        matrix: [
          [6, 1, 1],
          [4, -2, 5],
          [2, 8, 7],
        ],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.determinant).toBe(-306);
  });

  it("returns 1 for the identity matrix", async () => {
    const res = await POST(
      makeReq({
        matrix: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.determinant).toBe(1);
  });

  it("returns 0 for a singular matrix", async () => {
    const res = await POST(
      makeReq({
        matrix: [
          [1, 2],
          [2, 4],
        ],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.determinant).toBe(0);
  });

  it("rejects non-square matrices", async () => {
    const res = await POST(makeReq({ matrix: [[1, 2, 3], [4, 5, 6]] }));
    expect(res.status).toBe(400);
  });

  it("rejects matrices larger than 10x10", async () => {
    const matrix = Array.from({ length: 11 }, (_, row) =>
      Array.from({ length: 11 }, (_, col) => (row === col ? 1 : 0))
    );
    const res = await POST(makeReq({ matrix }));
    expect(res.status).toBe(400);
  });
});

describe("determinant", () => {
  it("matches the 2x2 formula", () => {
    expect(determinant([[1, 2], [3, 4]])).toBe(-2);
  });
});
