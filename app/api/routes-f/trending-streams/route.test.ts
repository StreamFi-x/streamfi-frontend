import { GET, SEED_STREAMS } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/routes-f/trending-streams", () => {
  it("should rank trending streams correctly", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/trending-streams");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    // CreatorB: score = 150 * 0.6 + 100 * 0.4 = 90 + 40 = 130
    // CreatorA: score = 100 * 0.6 + 0 * 0.4 = 60
    // CreatorC: score = 120 * 0.6 + (-80) * 0.4 = 72 - 32 = 40
    // Expected order: CreatorB, CreatorA, CreatorC
    
    expect(data.streams[0].id).toBe("stream-2");
    expect(data.streams[1].id).toBe("stream-1");
    expect(data.streams[2].id).toBe("stream-3");
  });

  it("should respect limit query parameter", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/trending-streams?limit=2");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.streams.length).toBe(2);
    expect(data.streams[0].id).toBe("stream-2");
    expect(data.streams[1].id).toBe("stream-1");
  });
});
