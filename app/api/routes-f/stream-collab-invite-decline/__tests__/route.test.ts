import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-collab-invite-decline",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/stream-collab-invite-decline", () => {
  it("declines a pending invite for the invited creator", async () => {
    const res = await POST(
      makePost({ invite_id: "invite_pending_1", creator_id: "creator_b" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.invite.status).toBe("declined");
    expect(body.invite.invite_id).toBe("invite_pending_1");
    expect(body.invite.resolved_at).not.toBeNull();
  });

  it("returns 404 for an unknown invite_id", async () => {
    const res = await POST(
      makePost({ invite_id: "does_not_exist", creator_id: "creator_b" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the requester is not the invite recipient", async () => {
    const res = await POST(
      makePost({ invite_id: "invite_pending_2", creator_id: "creator_a" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when the invite is already declined", async () => {
    const res = await POST(
      makePost({ invite_id: "invite_already_declined", creator_id: "creator_e" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the invite is already accepted", async () => {
    const res = await POST(
      makePost({ invite_id: "invite_already_accepted", creator_id: "creator_f" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when invite_id is missing", async () => {
    const res = await POST(makePost({ creator_id: "creator_b" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(makePost({ invite_id: "invite_pending_2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-collab-invite-decline",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow declining the same invite twice", async () => {
    const first = await POST(
      makePost({ invite_id: "invite_pending_2", creator_id: "creator_d" })
    );
    expect(first.status).toBe(200);

    const second = await POST(
      makePost({ invite_id: "invite_pending_2", creator_id: "creator_d" })
    );
    expect(second.status).toBe(409);
  });
});
