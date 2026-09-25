import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/account-delete-request",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/account-delete-request", () => {
  it("creates a pending deletion request 14 days out", async () => {
    const res = await POST(makePost({ user_id: "user_fresh_1" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.grace_period_days).toBe(14);
    expect(body.deletion_request.user_id).toBe("user_fresh_1");
    expect(body.deletion_request.status).toBe("pending");

    const requestedAt = new Date(body.deletion_request.requested_at).getTime();
    const scheduledAt = new Date(
      body.deletion_request.scheduled_deletion_at
    ).getTime();
    const diffDays = (scheduledAt - requestedAt) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(14, 5);
  });

  it("returns 409 when a deletion request is already pending", async () => {
    const res = await POST(
      makePost({ user_id: "user_with_pending_request" })
    );
    expect(res.status).toBe(409);
  });

  it("allows a new request after a previous one was cancelled", async () => {
    const res = await POST(
      makePost({ user_id: "user_with_cancelled_request" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletion_request.status).toBe("pending");
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/account-delete-request",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow two pending requests back to back for the same user", async () => {
    const first = await POST(makePost({ user_id: "user_fresh_2" }));
    expect(first.status).toBe(200);

    const second = await POST(makePost({ user_id: "user_fresh_2" }));
    expect(second.status).toBe(409);
  });
});
