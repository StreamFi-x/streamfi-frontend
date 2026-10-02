/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/matrix-multiply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/matrix-multiply", () => {
  it("multiplies square matrices", async () => {
    const res = await POST(
      makeReq({
        a: [
          [1, 2],
          [3, 4],
        ],
        b: [
          [5, 6],
          [7, 8],
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toEqual([
      [19, 22],
      [43, 50],
    ]);
    expect(body.dimensions.result).toEqual({ rows: 2, columns: 2 });
  });

  it("multiplies rectangular matrices", async () => {
    const res = await POST(
      makeReq({
        a: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        b: [
          [7, 8],
          [9, 10],
          [11, 12],
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toEqual([
      [58, 64],
      [139, 154],
    ]);
  });

  it("preserves a matrix multiplied by identity", async () => {
    const matrix = [
      [2, -1],
      [0, 3],
    ];
    const res = await POST(
      makeReq({
        a: matrix,
        b: [
          [1, 0],
          [0, 1],
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toEqual(matrix);
  });

  it("rejects incompatible dimensions", async () => {
    const res = await POST(
      makeReq({
        a: [[1, 2]],
        b: [[1, 2]],
      })
    );

    expect(res.status).toBe(400);
  });
});
