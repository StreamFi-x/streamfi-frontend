jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST } from "../route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f deck", () => {
  it("shuffles deterministically with the same seed", async () => {
    const body = {
      hands: 2,
      cards_per_hand: 5,
      seed: "streamfi-seed",
      jokers: false,
    };

    const firstRes = await POST(makeRequest(body));
    const secondRes = await POST(makeRequest(body));
    const first = await firstRes.json();
    const second = await secondRes.json();

    expect(first).toEqual(second);
  });

  it("deals unique cards without duplicates", async () => {
    const res = await POST(
      makeRequest({
        hands: 4,
        cards_per_hand: 5,
        seed: 42,
        jokers: true,
      })
    );
    const json = await res.json();
    const dealt = [...json.hands.flat(), ...json.remaining];
    const unique = new Set(dealt);

    expect(res.status).toBe(200);
    expect(dealt).toHaveLength(54);
    expect(unique.size).toBe(54);
  });

  it("rejects requests that exceed deck size", async () => {
    const res = await POST(
      makeRequest({
        hands: 11,
        cards_per_hand: 5,
      })
    );

    expect(res.status).toBe(400);
  });
});
