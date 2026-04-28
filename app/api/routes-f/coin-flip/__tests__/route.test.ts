import { POST } from "../route";
import { NextRequest } from "next/server";

type FlipResponse = {
  flips: Array<"H" | "T">;
  heads_count: number;
  tails_count: number;
  longest_streak: { side: "H" | "T"; length: number; start_index: number };
};

function makePost(body: object): NextRequest {
  return new Request("http://localhost/api/routes-f/coin-flip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/routes-f/coin-flip", () => {
  it("returns one flip by default", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(200);
    const data = await res.json() as FlipResponse;
    expect(data.flips).toHaveLength(1);
    expect(data.heads_count + data.tails_count).toBe(1);
  });

  it("supports deterministic flips with a seed", async () => {
    const first = await POST(makePost({ count: 5, seed: 123, bias: 0.5 }));
    const second = await POST(makePost({ count: 5, seed: 123, bias: 0.5 }));
    expect(await first.json()).toEqual(await second.json());
  });

  it("respects bias values of 0 and 1", async () => {
    const allHeads = await POST(makePost({ count: 4, seed: 1, bias: 1 }));
    const headsData = await allHeads.json() as FlipResponse;
    expect(headsData.flips.every((f) => f === "H")).toBe(true);

    const allTails = await POST(makePost({ count: 4, seed: 1, bias: 0 }));
    const tailsData = await allTails.json() as FlipResponse;
    expect(tailsData.flips.every((f) => f === "T")).toBe(true);
  });

  it("computes the longest streak correctly", async () => {
    const res = await POST(makePost({ count: 6, seed: 999, bias: 0.5 }));
    expect(res.status).toBe(200);
    const data = await res.json() as FlipResponse;
    expect(data.longest_streak.length).toBeGreaterThanOrEqual(1);
    expect(data.longest_streak.start_index).toBeGreaterThanOrEqual(0);
    expect(data.longest_streak.side).toMatch(/H|T/);
  });

  it("rejects invalid counts", async () => {
    const res = await POST(makePost({ count: 0 }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid bias values", async () => {
    const res = await POST(makePost({ bias: 1.5 }));
    expect(res.status).toBe(400);
  });
});
