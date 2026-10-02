/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-collab-leave", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/stream-collab-leave", () => {
  it("a guest leaving keeps the session active and removes only that guest", async () => {
    const res = await POST(
      makePost({
        collab_session_id: "collab_three_participants",
        creator_id: "creator_guest_a",
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("active");
    expect(body.participants).toHaveLength(2);
    expect(
      body.participants.find((p: { creator_id: string }) => p.creator_id === "creator_guest_a")
    ).toBeUndefined();
    expect(
      body.participants.find((p: { creator_id: string }) => p.creator_id === "creator_host_2")
    ).toBeDefined();
  });

  it("the host leaving ends the session for everyone", async () => {
    const res = await POST(
      makePost({
        collab_session_id: "collab_two_participants",
        creator_id: "creator_host",
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ended");
    // Roster is preserved (minus the leaving host) for post-session history.
    expect(body.participants).toHaveLength(1);
    expect(body.participants[0].creator_id).toBe("creator_guest");
  });

  it("the last remaining participant leaving ends the session", async () => {
    const res = await POST(
      makePost({
        collab_session_id: "collab_solo_host",
        creator_id: "creator_host_3",
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ended");
    expect(body.participants).toHaveLength(0);
  });

  it("returns 403 when the caller is not a participant of the session", async () => {
    const res = await POST(
      makePost({
        collab_session_id: "collab_for_outsider_check",
        creator_id: "creator_outsider",
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown collab_session_id", async () => {
    const res = await POST(
      makePost({ collab_session_id: "does_not_exist", creator_id: "creator_host" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when the session has already ended", async () => {
    const res = await POST(
      makePost({
        collab_session_id: "collab_ended_session",
        creator_id: "creator_host_4",
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when collab_session_id is missing", async () => {
    const res = await POST(makePost({ creator_id: "creator_host" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(
      makePost({ collab_session_id: "collab_two_participants" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-collab-leave",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
