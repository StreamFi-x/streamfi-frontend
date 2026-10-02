/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET } from "../stream/category-switch/route";
import { categoryTimelines } from "../stream/category-switch/store";

function postReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/stream/category-switch",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function getReq(streamId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/stream/category-switch?stream_id=${streamId}`
  );
}

describe("/api/routes-f/stream/category-switch", () => {
  beforeEach(() => {
    categoryTimelines.clear();
  });

  describe("POST — switch category", () => {
    it("switches to a valid category and returns previous + new", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", category: "gaming" })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.previous_category).toBe("none");
      expect(data.new_category).toBe("gaming");
      expect(data.switched_at).toBeDefined();
    });

    it("tracks successive category switches", async () => {
      await POST(postReq({ stream_id: "s1", category: "gaming" }));
      const res = await POST(
        postReq({ stream_id: "s1", category: "music" })
      );
      const data = await res.json();
      expect(data.previous_category).toBe("gaming");
      expect(data.new_category).toBe("music");
    });

    it("rejects an unknown category", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", category: "underwater-basket-weaving" })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Unknown category/);
    });

    it("rejects missing stream_id", async () => {
      const res = await POST(postReq({ category: "gaming" }));
      expect(res.status).toBe(400);
    });

    it("rejects missing category", async () => {
      const res = await POST(postReq({ stream_id: "s1" }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid JSON body", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/stream/category-switch",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json",
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GET — category timeline", () => {
    it("returns empty timeline for a fresh stream", async () => {
      const res = await GET(getReq("s1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timeline).toEqual([]);
    });

    it("returns full timeline after multiple switches", async () => {
      await POST(postReq({ stream_id: "s1", category: "gaming" }));
      await POST(postReq({ stream_id: "s1", category: "music" }));
      await POST(postReq({ stream_id: "s1", category: "irl" }));

      const res = await GET(getReq("s1"));
      const data = await res.json();
      expect(data.stream_id).toBe("s1");
      expect(data.timeline).toHaveLength(3);
      expect(data.timeline[0].category).toBe("gaming");
      expect(data.timeline[1].category).toBe("music");
      expect(data.timeline[2].category).toBe("irl");
    });

    it("rejects missing stream_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/stream/category-switch"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });
});
