/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/combinatorics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/combinatorics", () => {
  it("counts known combination values", async () => {
    const res = await POST(
      makeReq({ mode: "count", n: 5, r: 2, type: "combination" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.value).toBe("10");
  });

  it("counts known permutation values", async () => {
    const res = await POST(
      makeReq({ mode: "count", n: 5, r: 2, type: "permutation" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.value).toBe("20");
  });

  it("enumerates combinations in input order", async () => {
    const res = await POST(
      makeReq({
        mode: "enumerate",
        n: 3,
        r: 2,
        type: "combination",
        items: ["a", "b", "c"],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
  });

  it("enumerates permutations", async () => {
    const res = await POST(
      makeReq({
        mode: "enumerate",
        n: 3,
        r: 2,
        type: "permutation",
        items: [1, 2, 3],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toContainEqual([1, 2]);
    expect(body.results).toContainEqual([2, 1]);
    expect(body.results).toHaveLength(6);
  });

  it("counts large values with BigInt", async () => {
    const res = await POST(
      makeReq({ mode: "count", n: 100, r: 50, type: "combination" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.value).toBe("100891344545564193334812497256");
  });

  it("caps enumeration output at 10000 results", async () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const res = await POST(
      makeReq({ mode: "enumerate", n: 12, r: 6, type: "permutation", items }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(10000);
  });

  it("rejects invalid r greater than n", async () => {
    const res = await POST(
      makeReq({ mode: "count", n: 2, r: 3, type: "combination" }),
    );

    expect(res.status).toBe(400);
  });
});
