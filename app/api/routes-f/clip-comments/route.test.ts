import { GET, POST, CLIP_COMMENTS } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-comments";

function postReq(body: unknown) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createComment(
  clip_id: string,
  author: string,
  text: string,
  parent_comment_id?: string
): Promise<string> {
  const res = await POST(postReq({ clip_id, author, text, parent_comment_id }));
  const data = await res.json();
  return data.comment_id;
}

describe("Clip Comments Thread", () => {
  beforeEach(() => {
    for (const key in CLIP_COMMENTS) {
      delete CLIP_COMMENTS[key];
    }
  });

  describe("POST /api/routes-f/clip-comments", () => {
    it("should create a top-level comment and return comment_id", async () => {
      const res = await POST(
        postReq({ clip_id: "clip-1", author: "alice", text: "Great clip!" })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.comment_id).toBeDefined();
      expect(CLIP_COMMENTS[data.comment_id].clip_id).toBe("clip-1");
      expect(CLIP_COMMENTS[data.comment_id].parent_comment_id).toBeNull();
    });

    it("should create a reply to a top-level comment", async () => {
      const parentId = await createComment("clip-1", "alice", "Great clip!");
      const res = await POST(
        postReq({
          clip_id: "clip-1",
          author: "bob",
          text: "Agreed!",
          parent_comment_id: parentId,
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(CLIP_COMMENTS[data.comment_id].parent_comment_id).toBe(parentId);
    });

    it("should reject a reply to a reply (depth capped at 1)", async () => {
      const parentId = await createComment("clip-1", "alice", "Great clip!");
      const replyId = await createComment("clip-1", "bob", "Agreed!", parentId);

      const res = await POST(
        postReq({
          clip_id: "clip-1",
          author: "carol",
          text: "Me too!",
          parent_comment_id: replyId,
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Cannot reply to a reply (max depth is 1)");
    });

    it("should return 404 for an unknown parent_comment_id", async () => {
      const res = await POST(
        postReq({
          clip_id: "clip-1",
          author: "bob",
          text: "hi",
          parent_comment_id: "comment-999",
        })
      );

      expect(res.status).toBe(404);
    });

    it("should reject a parent comment from a different clip", async () => {
      const parentId = await createComment("clip-1", "alice", "Great clip!");
      const res = await POST(
        postReq({
          clip_id: "clip-2",
          author: "bob",
          text: "hi",
          parent_comment_id: parentId,
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("parent_comment_id belongs to a different clip");
    });

    it("should return 400 when required fields are missing", async () => {
      const missingClip = await POST(postReq({ author: "alice", text: "hi" }));
      expect(missingClip.status).toBe(400);

      const missingAuthor = await POST(postReq({ clip_id: "clip-1", text: "hi" }));
      expect(missingAuthor.status).toBe(400);

      const missingText = await POST(postReq({ clip_id: "clip-1", author: "alice" }));
      expect(missingText.status).toBe(400);

      const blankText = await POST(
        postReq({ clip_id: "clip-1", author: "alice", text: "   " })
      );
      expect(blankText.status).toBe(400);
    });

    it("should return 400 for invalid JSON", async () => {
      const req = new NextRequest(BASE, { method: "POST", body: "not-json" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/routes-f/clip-comments", () => {
    it("should return 400 when clip_id is missing", async () => {
      const res = await GET(new NextRequest(BASE));
      expect(res.status).toBe(400);
    });

    it("should list top-level comments with reply counts", async () => {
      const c1 = await createComment("clip-1", "alice", "First!");
      await createComment("clip-1", "bob", "Reply A", c1);
      await createComment("clip-1", "carol", "Reply B", c1);
      await createComment("clip-1", "dan", "Second!");
      await createComment("clip-other", "eve", "Different clip");

      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-1`));
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].text).toBe("First!");
      expect(data.comments[0].reply_count).toBe(2);
      expect(data.comments[1].text).toBe("Second!");
      expect(data.comments[1].reply_count).toBe(0);
      expect(data.has_more).toBe(false);
      expect(data.next_cursor).toBeNull();
    });

    it("should not include replies as top-level comments", async () => {
      const c1 = await createComment("clip-1", "alice", "Top");
      await createComment("clip-1", "bob", "Reply", c1);

      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-1`));
      const data = await res.json();
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].text).toBe("Top");
    });

    it("should paginate with cursor", async () => {
      const ids: string[] = [];
      for (let i = 1; i <= 5; i++) {
        ids.push(await createComment("clip-1", "alice", `Comment ${i}`));
      }

      const page1 = await GET(new NextRequest(`${BASE}?clip_id=clip-1&limit=2`));
      const data1 = await page1.json();
      expect(data1.comments.map((c: { text: string }) => c.text)).toEqual([
        "Comment 1",
        "Comment 2",
      ]);
      expect(data1.has_more).toBe(true);
      expect(data1.next_cursor).toBe(ids[1]);

      const page2 = await GET(
        new NextRequest(`${BASE}?clip_id=clip-1&limit=2&cursor=${data1.next_cursor}`)
      );
      const data2 = await page2.json();
      expect(data2.comments.map((c: { text: string }) => c.text)).toEqual([
        "Comment 3",
        "Comment 4",
      ]);
      expect(data2.has_more).toBe(true);

      const page3 = await GET(
        new NextRequest(`${BASE}?clip_id=clip-1&limit=2&cursor=${data2.next_cursor}`)
      );
      const data3 = await page3.json();
      expect(data3.comments.map((c: { text: string }) => c.text)).toEqual(["Comment 5"]);
      expect(data3.has_more).toBe(false);
      expect(data3.next_cursor).toBeNull();
    });

    it("should return 400 for an invalid cursor", async () => {
      await createComment("clip-1", "alice", "Only comment");
      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-1&cursor=comment-999`));
      expect(res.status).toBe(400);
    });

    it("should return 400 for an invalid limit", async () => {
      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-1&limit=0`));
      expect(res.status).toBe(400);

      const res2 = await GET(new NextRequest(`${BASE}?clip_id=clip-1&limit=abc`));
      expect(res2.status).toBe(400);
    });

    it("should return an empty list for a clip with no comments", async () => {
      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-empty`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.comments).toEqual([]);
      expect(data.has_more).toBe(false);
    });
  });
});
