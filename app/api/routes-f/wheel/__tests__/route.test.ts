/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/wheel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/wheel", () => {
  it("keeps the same wheel between spins in keep mode", async () => {
    const res = await POST(
      makeReq({ slices: ["A", "B", "C"], spins: 3, seed: "keep", mode: "keep" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(3);
    expect(body.total_slices_remaining).toBe(3);
    expect(body.results.map((r: any) => r.slices_remaining)).toEqual([3, 3, 3]);
  });

  it("removes winning slices in eliminate mode", async () => {
    const res = await POST(
      makeReq({
        slices: ["A", "B", "C"],
        spins: 3,
        seed: "eliminate",
        mode: "eliminate",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(3);
    expect(body.total_slices_remaining).toBe(0);
    expect(new Set(body.results.map((r: any) => r.selected.label)).size).toBe(
      3
    );
  });

  it("uses weights for selection", async () => {
    const res = await POST(
      makeReq({
        slices: [
          { label: "light", weight: 1 },
          { label: "heavy", weight: 100 },
        ],
        spins: 25,
        seed: "weighted",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(
      body.results.filter((r: any) => r.selected.label === "heavy").length
    ).toBeGreaterThan(20);
  });

  it("is deterministic when a seed is supplied", async () => {
    const payload = { slices: ["A", "B", "C"], spins: 10, seed: 668 };
    const first = await POST(makeReq(payload));
    const second = await POST(makeReq(payload));

    expect(await first.json()).toEqual(await second.json());
  });
});
