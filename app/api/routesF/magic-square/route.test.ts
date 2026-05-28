import { NextRequest } from "next/server";
import { generateMagicSquare } from "./generate";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/magic-square", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/magic-square", () => {
  it("validates a classic Lo Shu square", async () => {
    const matrix = [
      [8, 1, 6],
      [3, 5, 7],
      [4, 9, 2],
    ];

    const res = await POST(makeReq({ mode: "validate", matrix }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ is_magic: true, magic_constant: 15 });
  });

  it("detects a non-magic square", async () => {
    const res = await POST(
      makeReq({
        mode: "validate",
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      })
    );
    const data = await res.json();

    expect(data.is_magic).toBe(false);
    expect(data.magic_constant).toBe(6);
  });

  it("generates an odd-order magic square with the Siamese method", async () => {
    const res = await POST(makeReq({ mode: "generate", n: 3 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.magic_constant).toBe(15);
    expect(data.matrix).toEqual(generateMagicSquare(3));
  });

  it("rejects even sizes for generation", async () => {
    const res = await POST(makeReq({ mode: "generate", n: 4 }));

    expect(res.status).toBe(400);
  });
});
