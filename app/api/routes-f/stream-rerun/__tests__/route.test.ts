import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";
import { clearAllReruns } from "../store";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/stream-rerun");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-rerun", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-rerun", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("stream-rerun lifecycle", () => {
  beforeEach(() => {
    clearAllReruns();
  });

  describe("POST /api/routes-f/stream-rerun", () => {
    it("enables rerun for a creator", async () => {
      const res = await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: true })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rerun_active).toBe(true);
      expect(data.vod_id).toBe("vod_x");
      expect(typeof data.started_at).toBe("string");
    });

    it("disables rerun for a creator", async () => {
      await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: true })
      );
      const res = await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: false })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rerun_active).toBe(false);
      expect(data.vod_id).toBeNull();
      expect(data.started_at).toBeNull();
    });

    it("returns 400 when creator_id is missing", async () => {
      const res = await POST(
        makePostReq({ vod_id: "vod_x", enabled: true })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when vod_id is missing", async () => {
      const res = await POST(
        makePostReq({ creator_id: "c1", enabled: true })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when enabled is not boolean", async () => {
      const res = await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: "yes" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/routes-f/stream-rerun", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns inactive rerun for unknown creator", async () => {
      const res = await GET(makeGetReq({ creator_id: "unknown" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rerun_active).toBe(false);
      expect(data.vod_id).toBeNull();
      expect(data.started_at).toBeNull();
    });

    it("returns active rerun after setting it", async () => {
      await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: true })
      );
      const res = await GET(makeGetReq({ creator_id: "c1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rerun_active).toBe(true);
      expect(data.vod_id).toBe("vod_x");
    });
  });

  describe("DELETE /api/routes-f/stream-rerun", () => {
    it("clears rerun for a creator", async () => {
      await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: true })
      );
      const res = await DELETE(makeDeleteReq({ creator_id: "c1" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.cleared).toBe(true);
    });

    it("returns true when clearing non-existent rerun", async () => {
      const res = await DELETE(makeDeleteReq({ creator_id: "nobody" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.cleared).toBe(true);
    });

    it("returns 400 when creator_id is missing", async () => {
      const res = await DELETE(makeDeleteReq({}));
      expect(res.status).toBe(400);
    });

    it("GET returns inactive after DELETE", async () => {
      await POST(
        makePostReq({ creator_id: "c1", vod_id: "vod_x", enabled: true })
      );
      await DELETE(makeDeleteReq({ creator_id: "c1" }));
      const res = await GET(makeGetReq({ creator_id: "c1" }));
      const data = await res.json();
      expect(data.rerun_active).toBe(false);
    });
  });
});
