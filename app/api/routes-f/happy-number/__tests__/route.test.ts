jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { analyzeHappyNumber } from "../happy";
import { GET } from "../route";

// #863 feat(routes-f): happy number checker

function makeRequest(path: string) {
  return new Request(`http://localhost${path}`) as unknown as import("next/server").NextRequest;
}

describe("analyzeHappyNumber", () => {
  it("identifies 19 as happy with the known sequence", () => {
    expect(analyzeHappyNumber(19)).toEqual({
      n: 19,
      is_happy: true,
      sequence: [19, 82, 68, 100, 1],
    });
  });

  it("identifies 7 as happy", () => {
    expect(analyzeHappyNumber(7)).toEqual({
      n: 7,
      is_happy: true,
      sequence: [7, 49, 97, 130, 10, 1],
    });
  });

  it("identifies 4 as unhappy and terminates on cycle detection", () => {
    const result = analyzeHappyNumber(4);

    expect(result.is_happy).toBe(false);
    expect(result.sequence).toEqual([4, 16, 37, 58, 89, 145, 42, 20, 4]);
  });
});

describe("GET /api/routes-f/happy-number", () => {
  it("returns happy number analysis for n=19", async () => {
    const res = await GET(makeRequest("/api/routes-f/happy-number?n=19"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      n: 19,
      is_happy: true,
      sequence: [19, 82, 68, 100, 1],
    });
  });

  it("rejects non-positive integers", async () => {
    const missing = await GET(makeRequest("/api/routes-f/happy-number"));
    const zero = await GET(makeRequest("/api/routes-f/happy-number?n=0"));
    const negative = await GET(makeRequest("/api/routes-f/happy-number?n=-4"));
    const invalid = await GET(makeRequest("/api/routes-f/happy-number?n=abc"));

    expect(missing.status).toBe(400);
    expect(zero.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(invalid.status).toBe(400);
  });
});
