/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../categories/followed/route";

function makeReq(query: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/categories/followed?${query}`
  );
}

describe("Followed Categories Feed API", () => {
  it("should fail if viewer_id is missing", async () => {
    const req = makeReq("");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("viewer_id is required");
  });

  it("should return empty list if viewer follows no categories", async () => {
    const req = makeReq("viewer_id=viewer-no-follows");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.streams).toEqual([]);
  });

  it("should return streams in followed categories, sorted by viewer_count descending", async () => {
    // viewer-1 follows Gaming, Music, Talk Shows
    const req = makeReq("viewer_id=viewer-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.streams)).toBe(true);
    expect(data.streams.length).toBe(4);

    // Verify categories are correct
    const categories = data.streams.map((s: any) => s.category);
    expect(categories).toContain("Gaming");
    expect(categories).toContain("Music");
    expect(categories).toContain("Talk Shows");
    expect(categories).not.toContain("Crypto");
    expect(categories).not.toContain("Coding");
    expect(categories).not.toContain("Sports");

    // Verify ordering is descending by viewer_count
    // Expected order of followed categories:
    // 1. creator-gaming-1 (Gaming) - 1500 viewers
    // 2. creator-talk-1 (Talk Shows) - 1200 viewers
    // 3. creator-gaming-2 (Gaming) - 800 viewers
    // 4. creator-music-1 (Music) - 450 viewers
    expect(data.streams[0].creator).toBe("creator-gaming-1");
    expect(data.streams[1].creator).toBe("creator-talk-1");
    expect(data.streams[2].creator).toBe("creator-gaming-2");
    expect(data.streams[3].creator).toBe("creator-music-1");

    for (let i = 0; i < data.streams.length - 1; i++) {
      expect(data.streams[i].viewer_count).toBeGreaterThanOrEqual(
        data.streams[i + 1].viewer_count
      );
    }
  });

  it("should return correct streams for another viewer with correct ranking", async () => {
    // viewer-3 follows Crypto, Coding
    // Streams:
    // creator-crypto-1 (Crypto) - 3100 viewers
    // creator-coding-1 (Coding) - 950 viewers
    const req = makeReq("viewer_id=viewer-3");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.streams.length).toBe(2);
    expect(data.streams[0].creator).toBe("creator-crypto-1");
    expect(data.streams[1].creator).toBe("creator-coding-1");
  });
});
