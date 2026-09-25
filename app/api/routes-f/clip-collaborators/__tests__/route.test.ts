import { NextRequest } from "next/server";
import { POST, DELETE, GET } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/clip-collaborators", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDelete(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/clip-collaborators", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGet(clipId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/clip-collaborators?clip_id=${encodeURIComponent(
      clipId
    )}`
  );
}

describe("POST /api/routes-f/clip-collaborators", () => {
  it("adds a collaborator and returns added_at", async () => {
    const res = await POST(
      makePost({
        clip_id: "clip_fresh_1",
        collaborator_id: "user_a",
        role: "co-host",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.added_at).toBe("string");
  });

  it("returns 400 for an invalid role", async () => {
    const res = await POST(
      makePost({
        clip_id: "clip_fresh_2",
        collaborator_id: "user_b",
        role: "not-a-role",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await POST(
      makePost({ collaborator_id: "user_c", role: "guest" })
    );
    expect(res.status).toBe(400);
  });

  it("caps at 5 collaborators per clip", async () => {
    const clipId = "clip_capped";
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        makePost({
          clip_id: clipId,
          collaborator_id: `collab_${i}`,
          role: "guest",
        })
      );
      expect(res.status).toBe(200);
    }

    const sixth = await POST(
      makePost({
        clip_id: clipId,
        collaborator_id: "collab_overflow",
        role: "guest",
      })
    );
    expect(sixth.status).toBe(409);
  });

  it("allows updating an existing collaborator's role without counting against the cap", async () => {
    const clipId = "clip_update_role";
    for (let i = 0; i < 5; i++) {
      await POST(
        makePost({
          clip_id: clipId,
          collaborator_id: `collab_${i}`,
          role: "guest",
        })
      );
    }

    const update = await POST(
      makePost({
        clip_id: clipId,
        collaborator_id: "collab_0",
        role: "editor",
      })
    );
    expect(update.status).toBe(200);

    const list = await GET(makeGet(clipId));
    const body = await list.json();
    const updated = body.collaborators.find(
      (c: { collaborator_id: string }) => c.collaborator_id === "collab_0"
    );
    expect(updated.role).toBe("editor");
    expect(body.collaborators).toHaveLength(5);
  });
});

describe("GET /api/routes-f/clip-collaborators", () => {
  it("returns the seeded collaborators for a clip", async () => {
    const res = await GET(makeGet("clip_with_collaborators"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collaborators).toHaveLength(2);
    expect(body.collaborators[0].collaborator_id).toBe("collaborator_seed_1");
  });

  it("returns an empty list for a clip with no collaborators", async () => {
    const res = await GET(makeGet("clip_never_collaborated"));
    const body = await res.json();
    expect(body.collaborators).toEqual([]);
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routes-f/clip-collaborators")
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/routes-f/clip-collaborators", () => {
  it("removes an existing collaboration", async () => {
    await POST(
      makePost({
        clip_id: "clip_to_remove_from",
        collaborator_id: "user_to_remove",
        role: "editor",
      })
    );

    const res = await DELETE(
      makeDelete({
        clip_id: "clip_to_remove_from",
        collaborator_id: "user_to_remove",
      })
    );
    expect(res.status).toBe(200);

    const list = await GET(makeGet("clip_to_remove_from"));
    const body = await list.json();
    expect(body.collaborators).toEqual([]);
  });

  it("returns 404 when the collaboration does not exist", async () => {
    const res = await DELETE(
      makeDelete({
        clip_id: "clip_never_collaborated",
        collaborator_id: "nobody",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when collaborator_id is missing", async () => {
    const res = await DELETE(makeDelete({ clip_id: "clip_x" }));
    expect(res.status).toBe(400);
  });

  it("frees a cap slot so a new collaborator can be added", async () => {
    const clipId = "clip_capped_then_freed";
    for (let i = 0; i < 5; i++) {
      await POST(
        makePost({
          clip_id: clipId,
          collaborator_id: `collab_${i}`,
          role: "guest",
        })
      );
    }

    await DELETE(makeDelete({ clip_id: clipId, collaborator_id: "collab_0" }));

    const res = await POST(
      makePost({
        clip_id: clipId,
        collaborator_id: "collab_new",
        role: "guest",
      })
    );
    expect(res.status).toBe(200);
  });
});
