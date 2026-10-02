// @ts-nocheck
/**
 * @jest-environment node
 */
import { GET } from "../emoji-picker/route";

function makeReq(query: string) {
  return new globalThis.Request(
    `http://localhost/api/routesF/emoji-picker?${query}`
  );
}

describe("/api/routesF/emoji-picker", () => {
  it("returns emojis filtered by category", async () => {
    const res = await GET(makeReq("count=4&category=animals&seed=42"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("emojis");
    expect(data.emojis).toHaveLength(4);
    expect(
      data.emojis.every((item: unknown) => item?.category === "animals")
    ).toBe(true);
    expect(data.emojis[0]).toEqual(
      expect.objectContaining({
        emoji: expect.any(String),
        name: expect.any(String),
        category: "animals",
      })
    );
  });

  it("returns deterministic results for the same seed and category", async () => {
    const first = await GET(makeReq("count=5&category=faces&seed=123"));
    const second = await GET(makeReq("count=5&category=faces&seed=123"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstData = await first.json();
    const secondData = await second.json();

    expect(firstData).toEqual(secondData);
  });

  it("allows category any and returns mixed category emojis", async () => {
    const res = await GET(makeReq("count=6&category=any&seed=99"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emojis).toHaveLength(6);
    const categories = Array.from(
      new Set(data.emojis.map((item: unknown) => item?.category))
    );
    expect(categories.length).toBeGreaterThanOrEqual(1);
    expect(
      categories.every(category =>
        ["faces", "animals", "food"].includes(category)
      )
    ).toBe(true);
  });

  it("rejects invalid category values", async () => {
    const res = await GET(makeReq("count=3&category=vehicles&seed=1"));
    expect(res.status).toBe(400);
  });
});
