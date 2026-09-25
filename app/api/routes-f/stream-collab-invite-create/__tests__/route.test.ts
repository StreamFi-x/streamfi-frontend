import { NextRequest } from "next/server";
import { POST } from "../route";
import { verifyToken } from "@/lib/auth/sign-token";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-collab-invite-create",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/stream-collab-invite-create", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, SESSION_SECRET: "test-secret" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("creates a pending invite and returns a signed invite link", async () => {
    const res = await POST(
      makePost({
        from_creator_id: "creator_a",
        to_creator_id: "creator_b",
        stream_id: "stream_1",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.invite.status).toBe("pending");
    expect(body.invite.from_creator_id).toBe("creator_a");
    expect(body.invite.to_creator_id).toBe("creator_b");
    expect(body.invite.stream_id).toBe("stream_1");
    expect(body.invite.resolved_at).toBeNull();
    expect(typeof body.invite_link).toBe("string");
    expect(body.invite_link).toContain("token=");
  });

  it("signs the invite link with a token that decodes to the invite id", async () => {
    const res = await POST(
      makePost({
        from_creator_id: "creator_a",
        to_creator_id: "creator_b",
        stream_id: "stream_1",
      })
    );
    const body = await res.json();

    // invite_link may be relative (NEXT_PUBLIC_APP_URL unset in test env), so
    // parse the query string directly rather than constructing an absolute URL.
    const url = new URL(body.invite_link, "http://localhost");
    const token = url.searchParams.get("token")!;
    const payload = verifyToken<{ inviteId: string; purpose: string }>(
      token,
      "test-secret"
    );

    expect(payload).not.toBeNull();
    expect(payload?.inviteId).toBe(body.invite.invite_id);
    expect(payload?.purpose).toBe("collab_invite");
  });

  it("returns 400 when from_creator_id is missing", async () => {
    const res = await POST(
      makePost({ to_creator_id: "creator_b", stream_id: "stream_1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when to_creator_id is missing", async () => {
    const res = await POST(
      makePost({ from_creator_id: "creator_a", stream_id: "stream_1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await POST(
      makePost({ from_creator_id: "creator_a", to_creator_id: "creator_b" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when a creator tries to invite themselves", async () => {
    const res = await POST(
      makePost({
        from_creator_id: "creator_a",
        to_creator_id: "creator_a",
        stream_id: "stream_1",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when SESSION_SECRET is not configured", async () => {
    delete process.env.SESSION_SECRET;
    const res = await POST(
      makePost({
        from_creator_id: "creator_a",
        to_creator_id: "creator_b",
        stream_id: "stream_1",
      })
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = new NextRequest(
      "http://localhost/api/routes-f/stream-collab-invite-create",
      { method: "POST", body: "not json", headers: { "Content-Type": "application/json" } }
    );
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });
});
