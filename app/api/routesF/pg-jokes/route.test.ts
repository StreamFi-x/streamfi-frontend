/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getJokePool } from "./jokes-data";

function makeReq(query: string) {
  return new globalThis.Request(`http://localhost/api/routesF/pg-jokes?${query}`);
}

describe("/api/routesF/pg-jokes", () => {
  it("returns a joke from the pun category", async () => {
    const res = await GET(makeReq("category=pun&seed=42"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.category).toBe("pun");
    expect(typeof data.joke).toBe("string");
    expect(data.joke.length).toBeGreaterThan(0);
    expect(getJokePool("pun").some((entry) => entry.joke === data.joke)).toBe(true);
  });

  it("returns a joke from the knock-knock category", async () => {
    const res = await GET(makeReq("category=knock-knock&seed=7"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.category).toBe("knock-knock");
    expect(getJokePool("knock-knock").some((entry) => entry.joke === data.joke)).toBe(true);
  });

  it("returns a joke from the one-liner category", async () => {
    const res = await GET(makeReq("category=one-liner&seed=99"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.category).toBe("one-liner");
    expect(getJokePool("one-liner").some((entry) => entry.joke === data.joke)).toBe(true);
  });

  it("allows category any and returns jokes from any category", async () => {
    const res = await GET(makeReq("category=any&seed=15"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(["pun", "knock-knock", "one-liner"]).toContain(data.category);
    expect(getJokePool("any").some((entry) => entry.joke === data.joke)).toBe(true);
  });

  it("returns deterministic results for the same seed and category", async () => {
    const first = await GET(makeReq("category=pun&seed=42"));
    const second = await GET(makeReq("category=pun&seed=42"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
  });

  it("rejects invalid category values", async () => {
    const res = await GET(makeReq("category=sci-fi&seed=1"));
    expect(res.status).toBe(400);
  });

  it("rejects missing seed", async () => {
    const res = await GET(makeReq("category=pun"));
    expect(res.status).toBe(400);
  });
});
