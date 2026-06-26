/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, DELETE } from "../route";
import { getToken, resetStore } from "../store";

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/push-token", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function deleteReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/push-token", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetStore();
});

describe("POST /api/routes-f/push-token (register)", () => {
  describe("Validation", () => {
    it("rejects invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/push-token", {
        method: "POST",
        body: "{not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("requires viewer_id", async () => {
      const res = await POST(postReq({ platform: "ios", token: "abc" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("viewer_id");
    });

    it("requires a valid platform", async () => {
      const res = await POST(
        postReq({ viewer_id: "v1", platform: "blackberry", token: "abc" })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("platform");
    });

    it("requires token", async () => {
      const res = await POST(postReq({ viewer_id: "v1", platform: "ios" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("token");
    });

    it("accepts each valid platform", async () => {
      for (const platform of ["ios", "android", "web"]) {
        const res = await POST(
          postReq({ viewer_id: "v1", platform, token: `tok-${platform}` })
        );
        expect(res.status).toBe(201);
      }
    });
  });

  describe("Register", () => {
    it("returns a token_id and 201 on first registration", async () => {
      const res = await POST(
        postReq({ viewer_id: "v1", platform: "ios", token: "fcm-abc" })
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(typeof body.token_id).toBe("string");
      expect(body.token_id.length).toBeGreaterThan(0);
    });

    it("stores the token for the viewer+platform", async () => {
      await POST(postReq({ viewer_id: "v1", platform: "web", token: "w-1" }));
      const stored = getToken("v1", "web");
      expect(stored?.token).toBe("w-1");
    });

    it("keeps separate tokens per platform for the same viewer", async () => {
      const ios = await (
        await POST(postReq({ viewer_id: "v1", platform: "ios", token: "i-1" }))
      ).json();
      const web = await (
        await POST(postReq({ viewer_id: "v1", platform: "web", token: "w-1" }))
      ).json();
      expect(ios.token_id).not.toBe(web.token_id);
      expect(getToken("v1", "ios")?.token).toBe("i-1");
      expect(getToken("v1", "web")?.token).toBe("w-1");
    });

    it("is idempotent for the same token (no duplicate slot)", async () => {
      const first = await (
        await POST(postReq({ viewer_id: "v1", platform: "ios", token: "same" }))
      ).json();
      const second = await POST(
        postReq({ viewer_id: "v1", platform: "ios", token: "same" })
      );
      const secondBody = await second.json();
      expect(second.status).toBe(200);
      expect(secondBody.token_id).toBe(first.token_id);
    });
  });

  describe("Replace (dedup per viewer+platform)", () => {
    it("replaces the token value but reuses the token_id", async () => {
      const first = await (
        await POST(postReq({ viewer_id: "v1", platform: "ios", token: "old" }))
      ).json();

      const replaceRes = await POST(
        postReq({ viewer_id: "v1", platform: "ios", token: "new" })
      );
      const replaceBody = await replaceRes.json();

      expect(replaceRes.status).toBe(200);
      expect(replaceBody.token_id).toBe(first.token_id);
      expect(getToken("v1", "ios")?.token).toBe("new");
    });

    it("does not create a second slot on replace", async () => {
      await POST(postReq({ viewer_id: "v1", platform: "ios", token: "old" }));
      await POST(postReq({ viewer_id: "v1", platform: "ios", token: "new" }));
      // Only the latest token survives for this viewer+platform.
      expect(getToken("v1", "ios")?.token).toBe("new");
    });
  });
});

describe("DELETE /api/routes-f/push-token (remove)", () => {
  it("removes a token by token_id", async () => {
    const reg = await (
      await POST(postReq({ viewer_id: "v1", platform: "ios", token: "x" }))
    ).json();

    const res = await DELETE(deleteReq({ token_id: reg.token_id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toBe(true);
    expect(getToken("v1", "ios")).toBeUndefined();
  });

  it("removes a token by viewer_id + platform", async () => {
    await POST(postReq({ viewer_id: "v2", platform: "android", token: "y" }));

    const res = await DELETE(
      deleteReq({ viewer_id: "v2", platform: "android" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toBe(true);
    expect(getToken("v2", "android")).toBeUndefined();
  });

  it("returns removed:false when nothing matches", async () => {
    const res = await DELETE(deleteReq({ token_id: "tok_does_not_exist" }));
    const body = await res.json();
    expect(body.removed).toBe(false);
  });

  it("only removes the targeted viewer+platform slot", async () => {
    await POST(postReq({ viewer_id: "v3", platform: "ios", token: "a" }));
    await POST(postReq({ viewer_id: "v3", platform: "web", token: "b" }));

    await DELETE(deleteReq({ viewer_id: "v3", platform: "ios" }));
    expect(getToken("v3", "ios")).toBeUndefined();
    expect(getToken("v3", "web")?.token).toBe("b");
  });

  it("requires identifying fields", async () => {
    const res = await DELETE(deleteReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid platform when deleting by viewer+platform", async () => {
    const res = await DELETE(
      deleteReq({ viewer_id: "v1", platform: "symbian" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/push-token", {
      method: "DELETE",
      body: "{bad",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});

describe("Full lifecycle: register -> replace -> remove", () => {
  it("walks through the complete flow", async () => {
    const reg = await (
      await POST(postReq({ viewer_id: "v9", platform: "ios", token: "t1" }))
    ).json();

    const replace = await (
      await POST(postReq({ viewer_id: "v9", platform: "ios", token: "t2" }))
    ).json();
    expect(replace.token_id).toBe(reg.token_id);
    expect(getToken("v9", "ios")?.token).toBe("t2");

    const del = await (
      await DELETE(deleteReq({ token_id: reg.token_id }))
    ).json();
    expect(del.removed).toBe(true);
    expect(getToken("v9", "ios")).toBeUndefined();
  });
});
