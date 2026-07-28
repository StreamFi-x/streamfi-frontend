import { NextRequest } from "next/server";
import { GET } from "./route";

function makeReq(slug: string | null) {
  const url = new URL("http://localhost/api/routesF/editorial-genre-collection");
  if (slug !== null) url.searchParams.set("collection_slug", slug);
  return new NextRequest(url);
}

describe("GET /api/routesF/editorial-genre-collection", () => {
  it("returns a known collection with title, description, and creators", async () => {
    const res = await GET(makeReq("best-nigerian-streamers"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Best Nigerian Streamers");
    expect(Array.isArray(data.creators)).toBe(true);
    expect(data.creators.length).toBeGreaterThan(0);
  });

  it("returns a different known collection correctly", async () => {
    const res = await GET(makeReq("rising-music-creators"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Rising Music Creators");
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await GET(makeReq("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when collection_slug is missing", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(400);
  });

  it("each creator has the expected shape", async () => {
    const res = await GET(makeReq("top-esports-competitors"));
    const data = await res.json();

    for (const creator of data.creators) {
      expect(typeof creator.creator_id).toBe("string");
      expect(typeof creator.username).toBe("string");
      expect(typeof creator.tagline).toBe("string");
    }
  });
});
