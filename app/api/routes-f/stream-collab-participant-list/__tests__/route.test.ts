/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(collabSessionId?: string): NextRequest {
  const url = new URL("http://localhost/api/routes-f/stream-collab-participant-list");
  if (collabSessionId !== undefined) {
    url.searchParams.set("collab_session_id", collabSessionId);
  }
  return new NextRequest(url);
}

describe("GET /api/routes-f/stream-collab-participant-list", () => {
  it("returns all participants for an active session with two participants", async () => {
    const res = await GET(makeReq("collab_active_two_participants"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.collab_session_id).toBe("collab_active_two_participants");
    expect(body.status).toBe("active");
    expect(body.participants).toHaveLength(2);
    expect(body.participants[0]).toMatchObject({
      creator_id: "creator_host",
      role: "host",
    });
    expect(body.participants[1]).toMatchObject({
      creator_id: "creator_guest",
      role: "guest",
    });
  });

  it("returns a single participant for a solo session", async () => {
    const res = await GET(makeReq("collab_active_solo_host"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.participants).toHaveLength(1);
  });

  it("returns participants for an ended session too", async () => {
    const res = await GET(makeReq("collab_ended_session"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ended");
    expect(body.participants).toHaveLength(1);
  });

  it("returns 404 for an unknown collab_session_id", async () => {
    const res = await GET(makeReq("does_not_exist"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when collab_session_id is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });
});
