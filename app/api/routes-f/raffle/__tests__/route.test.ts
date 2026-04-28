import { POST } from "../route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/raffle";

function req(body: object) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /raffle", () => {
  it("uses deterministic selection with a seed", async () => {
    const payload = {
      entries: ["alice", "bob", { name: "carol", weight: 3 }],
      winners: 2,
      seed: "seed-123",
      allow_repeat: false,
    };

    const first = await POST(req(payload));
    const second = await POST(req(payload));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(await first.json()).toEqual(await second.json());
  });

  it("uses weighted selection bias", async () => {
    const res = await POST(
      req({
        entries: [
          { name: "heavy", weight: 10 },
          { name: "light", weight: 1 },
        ],
        winners: 2000,
        seed: "bias-seed",
        allow_repeat: true,
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    const heavyWins = body.winners.filter((name: string) => name === "heavy").length;
    const lightWins = body.winners.filter((name: string) => name === "light").length;

    expect(heavyWins).toBeGreaterThan(lightWins);
  });

  it("draws without replacement when allow_repeat is false", async () => {
    const res = await POST(
      req({ entries: ["a", "b", "c"], winners: 3, seed: "no-repeat", allow_repeat: false })
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(new Set(body.winners).size).toBe(3);
    expect(body.runners_up).toHaveLength(0);
  });
});
