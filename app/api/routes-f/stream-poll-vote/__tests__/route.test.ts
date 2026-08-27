import { NextRequest } from "next/server";
import { POST } from "../route";
import { pollStore } from "../seedData";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-poll-vote", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/stream-poll-vote", () => {
  it("casts a vote on an open poll", async () => {
    const res = await POST(
      makePost({ poll_id: "poll_open_1", choice_index: 1, viewer_id: "viewer_9" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual({ poll_id: "poll_open_1", choice_index: 1, votes: 1 });
    expect(pollStore.get("poll_open_1")?.choices[1].votes).toBe(1);
    expect(pollStore.get("poll_open_1")?.voters.has("viewer_9")).toBe(true);
  });

  it("returns 404 for an unknown poll_id", async () => {
    const res = await POST(
      makePost({ poll_id: "does_not_exist", choice_index: 0, viewer_id: "viewer_1" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when the poll deadline has passed", async () => {
    const res = await POST(
      makePost({ poll_id: "poll_expired", choice_index: 0, viewer_id: "viewer_new" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("deadline");
  });

  it("returns 400 for a negative choice_index", async () => {
    const res = await POST(
      makePost({ poll_id: "poll_open_1", choice_index: -1, viewer_id: "viewer_1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a choice_index out of range", async () => {
    const res = await POST(
      makePost({ poll_id: "poll_open_1", choice_index: 99, viewer_id: "viewer_1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when choice_index is missing", async () => {
    const res = await POST(makePost({ poll_id: "poll_open_1", viewer_id: "viewer_1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makePost({ poll_id: "poll_open_1", choice_index: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/stream-poll-vote", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when the same viewer votes twice", async () => {
    const first = await POST(
      makePost({ poll_id: "poll_open_1", choice_index: 0, viewer_id: "viewer_dup" })
    );
    expect(first.status).toBe(200);

    const second = await POST(
      makePost({ poll_id: "poll_open_1", choice_index: 2, viewer_id: "viewer_dup" })
    );
    expect(second.status).toBe(409);
  });
});
