import { NextRequest } from "next/server";
import { GET } from "../route";

describe("GET /api/routes-f/bingo", () => {
  it("returns deterministic cards for same seed", async () => {
    const reqA = new NextRequest("http://localhost/api/routes-f/bingo?seed=42");
    const reqB = new NextRequest("http://localhost/api/routes-f/bingo?seed=42");
    const resA = await GET(reqA);
    const resB = await GET(reqB);
    const bodyA = await resA.json();
    const bodyB = await resB.json();

    expect(bodyA.cards).toEqual(bodyB.cards);
  });

  it("keeps values in column ranges and free center", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/bingo?seed=10");
    const res = await GET(req);
    const { cards } = await res.json();
    const card = cards[0];

    for (let row = 0; row < 5; row++) {
      expect(card[row][0]).toBeGreaterThanOrEqual(1);
      expect(card[row][0]).toBeLessThanOrEqual(15);
      expect(card[row][1]).toBeGreaterThanOrEqual(16);
      expect(card[row][1]).toBeLessThanOrEqual(30);
      expect(card[row][3]).toBeGreaterThanOrEqual(46);
      expect(card[row][3]).toBeLessThanOrEqual(60);
      expect(card[row][4]).toBeGreaterThanOrEqual(61);
      expect(card[row][4]).toBeLessThanOrEqual(75);
    }

    expect(card[2][2]).toBe(0);
  });
});
