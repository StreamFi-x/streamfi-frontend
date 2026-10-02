/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/account-delete-cancel", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/account-delete-cancel", () => {
  it("cancels a pending account deletion within the grace period", async () => {
    const res = await POST(makePost({ user_id: "user-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletion_request.status).toBe("cancelled");
    expect(body.deletion_request.cancelled_at).not.toBeNull();
  });

  it("returns 404 when there is no deletion request for the user", async () => {
    const res = await POST(makePost({ user_id: "no-such-user" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the account has already been deleted", async () => {
    const res = await POST(makePost({ user_id: "user-3" }));
    expect(res.status).toBe(409);
  });

  it("returns 409 when the deletion was already cancelled", async () => {
    const res = await POST(makePost({ user_id: "user-4" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/account-delete-cancel", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow cancelling the same deletion request twice", async () => {
    const first = await POST(makePost({ user_id: "user-2" }));
    expect(first.status).toBe(200);

    const second = await POST(makePost({ user_id: "user-2" }));
    expect(second.status).toBe(409);
  });
});
