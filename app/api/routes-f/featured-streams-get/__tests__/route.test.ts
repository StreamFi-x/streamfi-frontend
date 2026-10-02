/**
 * @jest-environment node
 */
import { GET } from "../route";

describe("GET /api/routes-f/featured-streams-get", () => {
  it("returns 200 with the featured array", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.featured)).toBe(true);
    expect(body.featured.length).toBeGreaterThan(0);
  });

  it("orders entries by position ascending", async () => {
    const res = await GET();
    const body = await res.json();
    const positions = body.featured.map((f: { position: number }) => f.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it("includes the expected fields on each entry", async () => {
    const res = await GET();
    const body = await res.json();
    const entry = body.featured[0];
    expect(entry).toHaveProperty("creator_id");
    expect(entry).toHaveProperty("stream_id");
    expect(entry).toHaveProperty("stream_title");
    expect(entry).toHaveProperty("category");
    expect(entry).toHaveProperty("viewer_count");
    expect(entry).toHaveProperty("is_live");
  });
});
