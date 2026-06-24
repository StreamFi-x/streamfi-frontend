/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../stream/chat-timeout/route";
import { timeoutStore } from "../stream/chat-timeout/store";

function postReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/stream/chat-timeout",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function getReq(streamId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/stream/chat-timeout?stream_id=${streamId}`
  );
}

function deleteReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/stream/chat-timeout",
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("/api/routes-f/stream/chat-timeout", () => {
  beforeEach(() => {
    timeoutStore.clear();
  });

  describe("POST — apply timeout", () => {
    it("applies a timeout and returns expires_at", async () => {
      const res = await POST(
        postReq({
          stream_id: "s1",
          user_id: "u1",
          seconds: 300,
          reason: "spamming",
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expires_at).toBeDefined();
      const expiresAt = new Date(data.expires_at).getTime();
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it("allows optional reason to be omitted", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", user_id: "u1", seconds: 60 })
      );
      expect(res.status).toBe(200);
    });

    it("rejects seconds below 1", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", user_id: "u1", seconds: 0 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects seconds above 86400", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", user_id: "u1", seconds: 86401 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-integer seconds", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", user_id: "u1", seconds: 1.5 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing stream_id", async () => {
      const res = await POST(
        postReq({ user_id: "u1", seconds: 60 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing user_id", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", seconds: 60 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing seconds", async () => {
      const res = await POST(
        postReq({ stream_id: "s1", user_id: "u1" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET — list active timeouts", () => {
    it("returns empty list when no timeouts", async () => {
      const res = await GET(getReq("s1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timeouts).toEqual([]);
    });

    it("returns active timeouts with seconds_remaining", async () => {
      await POST(
        postReq({
          stream_id: "s1",
          user_id: "u1",
          seconds: 600,
          reason: "spam",
        })
      );
      await POST(
        postReq({ stream_id: "s1", user_id: "u2", seconds: 300 })
      );

      const res = await GET(getReq("s1"));
      const data = await res.json();
      expect(data.stream_id).toBe("s1");
      expect(data.timeouts).toHaveLength(2);
      expect(data.timeouts[0].seconds_remaining).toBeGreaterThan(0);
    });

    it("filters out expired timeouts automatically", async () => {
      // Manually insert an already-expired entry
      timeoutStore.set("s1:u-expired", {
        stream_id: "s1",
        user_id: "u-expired",
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });

      const res = await GET(getReq("s1"));
      const data = await res.json();
      expect(data.timeouts).toHaveLength(0);
    });

    it("rejects missing stream_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/stream/chat-timeout"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE — lift timeout", () => {
    it("lifts an active timeout", async () => {
      await POST(
        postReq({ stream_id: "s1", user_id: "u1", seconds: 300 })
      );

      const res = await DELETE(
        deleteReq({ stream_id: "s1", user_id: "u1" })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.lifted).toBe(true);

      // Verify it's gone
      const getRes = await GET(getReq("s1"));
      const getData = await getRes.json();
      expect(getData.timeouts).toHaveLength(0);
    });

    it("returns lifted=false when no timeout exists", async () => {
      const res = await DELETE(
        deleteReq({ stream_id: "s1", user_id: "u-none" })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.lifted).toBe(false);
    });

    it("rejects missing stream_id", async () => {
      const res = await DELETE(deleteReq({ user_id: "u1" }));
      expect(res.status).toBe(400);
    });

    it("rejects missing user_id", async () => {
      const res = await DELETE(deleteReq({ stream_id: "s1" }));
      expect(res.status).toBe(400);
    });
  });
});
