import { GET, POST } from "../route";
import { GET as GET_ID, DELETE as DELETE_ID } from "../[id]/route";
import { __resetCommentsStore } from "../_lib/store";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/comments";

function req(method: string, body?: object, url = BASE) {
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  __resetCommentsStore();
});

describe("/comments threaded CRUD", () => {
  it("creates nested replies and returns flat thread with depth", async () => {
    const rootRes = await POST(req("POST", { author: "alice", text: "root" }));
    const root = (await rootRes.json()).comment;

    const replyRes = await POST(
      req("POST", { author: "bob", text: "reply", parent_id: root.id })
    );
    const reply = (await replyRes.json()).comment;

    const nestedRes = await POST(
      req("POST", { author: "carol", text: "nested", parent_id: reply.id })
    );
    expect(nestedRes.status).toBe(201);

    const listRes = await GET();
    expect(listRes.status).toBe(200);
    const body = await listRes.json();

    expect(body.comments).toHaveLength(3);
    expect(body.comments[0]).toEqual(
      expect.objectContaining({ id: root.id, depth: 0, parent_id: null })
    );
    expect(body.comments[1]).toEqual(
      expect.objectContaining({ id: reply.id, depth: 1, parent_id: root.id })
    );
    expect(body.comments[2]).toEqual(expect.objectContaining({ depth: 2, parent_id: reply.id }));
  });

  it("returns nested descendants for /comments/[id]", async () => {
    const root = (await (await POST(req("POST", { author: "a", text: "r" }))).json()).comment;
    const child = (
      await (await POST(req("POST", { author: "b", text: "c", parent_id: root.id }))).json()
    ).comment;

    await POST(req("POST", { author: "c", text: "g", parent_id: child.id }));

    const res = await GET_ID(req("GET", undefined, `${BASE}/${root.id}`), idCtx(root.id));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.comment.id).toBe(root.id);
    expect(body.comment.children).toHaveLength(1);
    expect(body.comment.children[0].id).toBe(child.id);
    expect(body.comment.children[0].children).toHaveLength(1);
  });

  it("soft delete keeps thread structure", async () => {
    const root = (await (await POST(req("POST", { author: "a", text: "root" }))).json()).comment;
    const child = (
      await (await POST(req("POST", { author: "b", text: "child", parent_id: root.id }))).json()
    ).comment;

    const del = await DELETE_ID(req("DELETE", undefined, `${BASE}/${root.id}`), idCtx(root.id));
    expect(del.status).toBe(200);

    const res = await GET_ID(req("GET", undefined, `${BASE}/${root.id}`), idCtx(root.id));
    const body = await res.json();

    expect(body.comment.deleted).toBe(true);
    expect(body.comment.text).toBe("[deleted]");
    expect(body.comment.children).toHaveLength(1);
    expect(body.comment.children[0].id).toBe(child.id);
  });

  it("enforces max reply depth of 6", async () => {
    let parentId: string | undefined;

    for (let i = 0; i <= 6; i++) {
      const res = await POST(
        req("POST", {
          author: `u${i}`,
          text: `c${i}`,
          ...(parentId ? { parent_id: parentId } : {}),
        })
      );
      expect(res.status).toBe(201);
      parentId = (await res.json()).comment.id;
    }

    const tooDeep = await POST(
      req("POST", {
        author: "overflow",
        text: "too deep",
        parent_id: parentId,
      })
    );

    expect(tooDeep.status).toBe(400);
    const body = await tooDeep.json();
    expect(body.error).toMatch(/maximum reply depth/i);
  });
});
