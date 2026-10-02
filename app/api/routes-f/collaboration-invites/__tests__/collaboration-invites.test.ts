/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, PUT, GET, PATCH } from "../route";
import { clearInviteStore } from "../store";

function postReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/collaboration-invites",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function putReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/collaboration-invites",
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function getReq(creator_id: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/collaboration-invites?creator_id=${creator_id}`
  );
}

function patchReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/collaboration-invites",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("/api/routes-f/collaboration-invites", () => {
  beforeEach(() => {
    clearInviteStore();
  });

  describe("POST — create invitation", () => {
    it("creates a new invitation with pending status", async () => {
      const res = await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_789",
          message: "Let's collaborate on this stream!",
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invite_id).toBeDefined();
      expect(data.status).toBe("pending");
    });

    it("prevents duplicate pending invitations", async () => {
      // Create first invitation
      await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_789",
        })
      );

      // Try to create second invitation
      const res = await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_999",
        })
      );

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("already exists");
      expect(data.code).toBe("DUPLICATE_PENDING_INVITE");
    });

    it("requires all required fields", async () => {
      const res = await POST(
        postReq({
          from_creator_id: "creator_123",
          // missing to_creator_id and stream_id
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid request body");
    });
  });

  describe("PUT — respond to invitation", () => {
    it("accepts an invitation", async () => {
      // Create invitation first
      const createRes = await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_789",
        })
      );
      const createData = await createRes.json();
      const inviteId = createData.invite_id;

      // Accept the invitation
      const res = await PUT(
        putReq({
          invite_id: inviteId,
          decision: "accept",
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invite_id).toBe(inviteId);
      expect(data.status).toBe("accepted");
    });

    it("declines an invitation", async () => {
      // Create invitation first
      const createRes = await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_789",
        })
      );
      const createData = await createRes.json();
      const inviteId = createData.invite_id;

      // Decline the invitation
      const res = await PUT(
        putReq({
          invite_id: inviteId,
          decision: "decline",
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.invite_id).toBe(inviteId);
      expect(data.status).toBe("declined");
    });

    it("returns 404 for non-existent invitation", async () => {
      const res = await PUT(
        putReq({
          invite_id: "nonexistent_id",
          decision: "accept",
        })
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Invitation not found");
    });

    it("requires valid decision", async () => {
      const res = await PUT(
        putReq({
          invite_id: "inv_123",
          decision: "invalid_decision", // invalid
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid request body");
    });
  });

  describe("GET — list invitations", () => {
    it("returns incoming and outgoing invitations", async () => {
      // Create some invitations
      await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_1",
        })
      );

      await POST(
        postReq({
          from_creator_id: "creator_789",
          to_creator_id: "creator_123",
          stream_id: "stream_2",
        })
      );

      // Get invitations for creator_123
      const res = await getReq("creator_123");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.incoming).toHaveLength(1);
      expect(data.outgoing).toHaveLength(1);
      
      // Verify incoming invitation
      expect(data.incoming[0].from_creator_id).toBe("creator_789");
      expect(data.incoming[0].to_creator_id).toBe("creator_123");
      
      // Verify outgoing invitation
      expect(data.outgoing[0].from_creator_id).toBe("creator_123");
      expect(data.outgoing[0].to_creator_id).toBe("creator_456");
    });

    it("returns empty arrays when no invitations", async () => {
      const res = await getReq("creator_999");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.incoming).toEqual([]);
      expect(data.outgoing).toEqual([]);
    });

    it("requires creator_id parameter", async () => {
      const res = await GET(new NextRequest("http://localhost/api/routes-f/collaboration-invites"));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid query parameters");
    });
  });

  describe("PATCH — get invite details", () => {
    it("returns invite details", async () => {
      // Create invitation
      const createRes = await POST(
        postReq({
          from_creator_id: "creator_123",
          to_creator_id: "creator_456",
          stream_id: "stream_789",
          message: "Test message",
        })
      );
      const createData = await createRes.json();
      const inviteId = createData.invite_id;

      // Get invite details
      const res = await PATCH(patchReq({ invite_id: inviteId }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.invite_id).toBe(inviteId);
      expect(data.from_creator_id).toBe("creator_123");
      expect(data.to_creator_id).toBe("creator_456");
      expect(data.stream_id).toBe("stream_789");
      expect(data.message).toBe("Test message");
      expect(data.status).toBe("pending");
      expect(data.created_at).toBeDefined();
      expect(data.updated_at).toBeDefined();
    });

    it("returns 404 for non-existent invite", async () => {
      const res = await PATCH(patchReq({ invite_id: "nonexistent_id" }));
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Invitation not found");
    });
  });

  describe("invitation lifecycle", () => {
    it("completes full invitation lifecycle", async () => {
      // 1. Create invitation
      const createRes = await POST(
        postReq({
          from_creator_id: "creator_A",
          to_creator_id: "creator_B",
          stream_id: "stream_1",
        })
      );
      const createData = await createRes.json();
      const inviteId = createData.invite_id;

      // 2. Verify invitation appears in outgoing/incoming lists
      const creatorARes = await getReq("creator_A");
      const creatorAData = await creatorARes.json();
      expect(creatorAData.outgoing).toHaveLength(1);
      expect(creatorAData.outgoing[0].invite_id).toBe(inviteId);

      const creatorBRes = await getReq("creator_B");
      const creatorBData = await creatorBRes.json();
      expect(creatorBData.incoming).toHaveLength(1);
      expect(creatorBData.incoming[0].invite_id).toBe(inviteId);

      // 3. Accept invitation
      const acceptRes = await PUT(
        putReq({
          invite_id: inviteId,
          decision: "accept",
        })
      );
      const acceptData = await acceptRes.json();
      expect(acceptData.status).toBe("accepted");

      // 4. Verify status is updated in lists
      const updatedRes = await getReq("creator_A");
      const updatedData = await updatedRes.json();
      expect(updatedData.outgoing[0].status).toBe("accepted");
    });
  });
});