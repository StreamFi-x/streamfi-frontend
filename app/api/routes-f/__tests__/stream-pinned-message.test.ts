/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, DELETE, GET } from "../stream/pinned-message/route";
import { pinnedMessages } from "../stream/pinned-message/store";

function postReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/stream/pinned-message",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function getReq(streamId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/stream/pinned-message?stream_id=${streamId}`
  );
}

function deleteReq(streamId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/stream/pinned-message?stream_id=${streamId}`,
    { method: "DELETE" }
  );
}

describe("/api/routes-f/stream/pinned-message", () => {
  beforeEach(() => {
    pinnedMessages.clear();
  });

  describe("POST — pin a message", () => {
    it("pins a message and returns pinned_at", async () => {
      const res = await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-1",
          message_text: "Hello everyone!",
          pinned_by: "mod-1",
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pinned_at).toBeDefined();
      expect(data.expires_at).toBeUndefined();
    });

    it("returns expires_at when provided", async () => {
      const expiresAt = new Date(Date.now() + 60000).toISOString();
      const res = await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-1",
          message_text: "Limited pin",
          pinned_by: "mod-1",
          expires_at: expiresAt,
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expires_at).toBe(expiresAt);
    });

    it("replaces the previous pin (only most recent is active)", async () => {
      await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-1",
          message_text: "First pin",
          pinned_by: "mod-1",
        })
      );
      await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-2",
          message_text: "Second pin",
          pinned_by: "mod-2",
        })
      );

      const res = await GET(getReq("s1"));
      const data = await res.json();
      expect(data.pin.message_id).toBe("msg-2");
      expect(data.pin.message_text).toBe("Second pin");
    });

    it("rejects missing stream_id", async () => {
      const res = await POST(
        postReq({
          message_id: "m1",
          message_text: "t",
          pinned_by: "u1",
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing message_id", async () => {
      const res = await POST(
        postReq({
          stream_id: "s1",
          message_text: "t",
          pinned_by: "u1",
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing message_text", async () => {
      const res = await POST(
        postReq({
          stream_id: "s1",
          message_id: "m1",
          pinned_by: "u1",
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing pinned_by", async () => {
      const res = await POST(
        postReq({
          stream_id: "s1",
          message_id: "m1",
          message_text: "t",
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid expires_at", async () => {
      const res = await POST(
        postReq({
          stream_id: "s1",
          message_id: "m1",
          message_text: "t",
          pinned_by: "u1",
          expires_at: "not-a-date",
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE — unpin", () => {
    it("unpins the current message", async () => {
      await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-1",
          message_text: "Pin",
          pinned_by: "mod-1",
        })
      );

      const delRes = await DELETE(deleteReq("s1"));
      expect(delRes.status).toBe(200);
      expect((await delRes.json()).unpinned).toBe(true);

      const getRes = await GET(getReq("s1"));
      const data = await getRes.json();
      expect(data.pin).toBeNull();
    });

    it("rejects missing stream_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/stream/pinned-message",
        { method: "DELETE" }
      );
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GET — get current pin", () => {
    it("returns null when no pin exists", async () => {
      const res = await GET(getReq("s1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pin).toBeNull();
    });

    it("returns the current pin", async () => {
      await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-1",
          message_text: "Pinned!",
          pinned_by: "mod-1",
        })
      );

      const res = await GET(getReq("s1"));
      const data = await res.json();
      expect(data.pin.message_id).toBe("msg-1");
      expect(data.pin.message_text).toBe("Pinned!");
      expect(data.pin.pinned_by).toBe("mod-1");
      expect(data.pin.pinned_at).toBeDefined();
    });

    it("auto-clears an expired pin", async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      await POST(
        postReq({
          stream_id: "s1",
          message_id: "msg-1",
          message_text: "Expired",
          pinned_by: "mod-1",
          expires_at: pastDate,
        })
      );

      const res = await GET(getReq("s1"));
      const data = await res.json();
      expect(data.pin).toBeNull();
    });

    it("rejects missing stream_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/stream/pinned-message"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });
});
