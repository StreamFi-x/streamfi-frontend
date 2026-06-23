/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, welcomeStore } from "../route";
import { POST as renderPOST } from "../render/route";

const BASE_URL = "http://localhost/api/routes-f/welcome";
const RENDER_URL = `${BASE_URL}/render`;

const CREATOR_ID = "c0ffeec0-0000-4000-8000-000000000001";
const OTHER_CREATOR = "c0ffeec0-0000-4000-8000-000000000002";

function makeGetReq(params: Record<string, string>) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function makePutReq(body: unknown) {
  return new NextRequest(BASE_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRenderReq(body: unknown) {
  return new NextRequest(RENDER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/welcome — GET + PUT", () => {
  beforeEach(() => {
    welcomeStore.clear();
  });

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------
  describe("GET", () => {
    it("returns the default template when nothing is stored", async () => {
      const res = await GET(makeGetReq({ creator_id: CREATOR_ID }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.creator_id).toBe(CREATOR_ID);
      expect(body.template).toBe("Welcome, {{username}}! Thanks for following.");
    });

    it("returns the stored template after a PUT", async () => {
      await PUT(
        makePutReq({
          creator_id: CREATOR_ID,
          template: "Hey {{username}}, welcome aboard!",
        })
      );

      const res = await GET(makeGetReq({ creator_id: CREATOR_ID }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.template).toBe("Hey {{username}}, welcome aboard!");
    });

    it("400 — missing creator_id", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("each creator has its own template", async () => {
      await PUT(
        makePutReq({
          creator_id: CREATOR_ID,
          template: "Hi {{username}}!",
        })
      );

      // OTHER_CREATOR should still see the default.
      const res = await GET(makeGetReq({ creator_id: OTHER_CREATOR }));
      const body = await res.json();
      expect(body.template).toContain("{{username}}");
      expect(body.template).toBe("Welcome, {{username}}! Thanks for following.");
    });
  });

  // -------------------------------------------------------------------------
  // PUT
  // -------------------------------------------------------------------------
  describe("PUT", () => {
    it("stores a custom template and returns it", async () => {
      const res = await PUT(
        makePutReq({
          creator_id: CREATOR_ID,
          template: "Welcome {{username}}, enjoy the stream!",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.creator_id).toBe(CREATOR_ID);
      expect(body.template).toBe("Welcome {{username}}, enjoy the stream!");
    });

    it("400 — template missing {{username}} placeholder", async () => {
      const res = await PUT(
        makePutReq({
          creator_id: CREATOR_ID,
          template: "Hey there! Welcome to my stream.",
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid template/i);
    });

    it("400 — missing template field", async () => {
      const res = await PUT(makePutReq({ creator_id: CREATOR_ID }));
      expect(res.status).toBe(400);
    });

    it("400 — missing creator_id", async () => {
      const res = await PUT(
        makePutReq({ template: "Hello {{username}}!" })
      );
      expect(res.status).toBe(400);
    });

    it("overwrites an existing template on subsequent PUT", async () => {
      await PUT(
        makePutReq({
          creator_id: CREATOR_ID,
          template: "First {{username}}!",
        })
      );

      await PUT(
        makePutReq({
          creator_id: CREATOR_ID,
          template: "Second {{username}}!",
        })
      );

      const res = await GET(makeGetReq({ creator_id: CREATOR_ID }));
      const body = await res.json();
      expect(body.template).toBe("Second {{username}}!");
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/routes-f/welcome/render
// ---------------------------------------------------------------------------
describe("POST /api/routes-f/welcome/render", () => {
  beforeEach(() => {
    welcomeStore.clear();
  });

  it("renders the stored template by replacing {{username}}", async () => {
    await PUT(
      makePutReq({
        creator_id: CREATOR_ID,
        template: "Hey {{username}}, welcome!",
      })
    );

    const res = await renderPOST(
      makeRenderReq({ creator_id: CREATOR_ID, username: "Alice" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Hey Alice, welcome!");
  });

  it("replaces all occurrences of {{username}} if the template repeats it", async () => {
    await PUT(
      makePutReq({
        creator_id: CREATOR_ID,
        template: "{{username}} here! Hi {{username}}!",
      })
    );

    const res = await renderPOST(
      makeRenderReq({ creator_id: CREATOR_ID, username: "Bob" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Bob here! Hi Bob!");
  });

  it("404 — creator has no stored template", async () => {
    const res = await renderPOST(
      makeRenderReq({ creator_id: OTHER_CREATOR, username: "Eve" })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no welcome template/i);
  });

  it("400 — missing creator_id", async () => {
    const res = await renderPOST(makeRenderReq({ username: "Dave" }));
    expect(res.status).toBe(400);
  });

  it("400 — missing username", async () => {
    const res = await renderPOST(makeRenderReq({ creator_id: CREATOR_ID }));
    expect(res.status).toBe(400);
  });

  it("400 — completely empty body", async () => {
    const res = await renderPOST(makeRenderReq({}));
    expect(res.status).toBe(400);
  });
});
