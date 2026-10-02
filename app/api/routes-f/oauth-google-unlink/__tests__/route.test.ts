import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/oauth-google-unlink",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/oauth-google-unlink", () => {
  it("unlinks Google when another login method exists", async () => {
    const res = await POST(makePost({ user_id: "user_google_and_password" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.user_id).toBe("user_google_and_password");
    expect(body.methods).toEqual(["password"]);
  });

  it("unlinks Google leaving github as the remaining method", async () => {
    const res = await POST(makePost({ user_id: "user_google_and_github" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toEqual(["github"]);
  });

  it("refuses to unlink when Google is the only login method", async () => {
    const res = await POST(makePost({ user_id: "user_google_only" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/only login method/i);
  });

  it("returns 409 when Google is not linked", async () => {
    const res = await POST(makePost({ user_id: "user_no_google" }));
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown user_id", async () => {
    const res = await POST(makePost({ user_id: "does_not_exist" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/oauth-google-unlink",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow unlinking Google twice", async () => {
    const first = await POST(makePost({ user_id: "user_google_and_password" }));
    expect(first.status).toBe(200);

    const second = await POST(makePost({ user_id: "user_google_and_password" }));
    expect(second.status).toBe(409);
  });
});
