import { GET, SEED_CLIPS } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/routes-f/clip-embed-metadata", () => {
  it("should return clip metadata when valid clip_id is provided", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/clip-embed-metadata?clip_id=clip-1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe(SEED_CLIPS["clip-1"].title);
    expect(data.thumbnail_url).toBe(SEED_CLIPS["clip-1"].thumbnail_url);
    expect(data.creator).toBe(SEED_CLIPS["clip-1"].creator);
    expect(data.duration_seconds).toBe(SEED_CLIPS["clip-1"].duration_seconds);
    expect(data.oembed_compatible_json).toEqual(SEED_CLIPS["clip-1"].oembed_compatible_json);
  });

  it("should return 404 for unknown clip_id", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/clip-embed-metadata?clip_id=nonexistent");
    const res = await GET(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Clip not found");
  });

  it("should return 400 when clip_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/clip-embed-metadata");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("clip_id is required");
  });
});
