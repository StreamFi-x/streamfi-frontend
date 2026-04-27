import { GET, POST } from "../route";
import { GET as GET_ID, PATCH, DELETE } from "../[id]/route";
import { _clear } from "../_lib/store";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/bookmarks";

function req(method: string, body?: object, url = BASE) {
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => _clear());

describe("POST /bookmarks — create", () => {
  it("creates a bookmark and returns 201", async () => {
    const res = await POST(req("POST", { url: "https://example.com", title: "Example" }));
    expect(res.status).toBe(201);
    const { bookmark } = await res.json();
    expect(bookmark.id).toBeDefined();
    expect(bookmark.url).toBe("https://example.com");
    expect(bookmark.title).toBe("Example");
    expect(bookmark.tags).toEqual([]);
    expect(bookmark.created_at).toBeDefined();
  });

  it("creates with optional fields", async () => {
    const res = await POST(
      req("POST", {
        url: "https://example.com",
        title: "Tagged",
        description: "A desc",
        tags: ["dev", "news"],
      })
    );
    const { bookmark } = await res.json();
    expect(bookmark.description).toBe("A desc");
    expect(bookmark.tags).toEqual(["dev", "news"]);
  });

  it("returns 400 for missing url", async () => {
    const res = await POST(req("POST", { title: "No URL" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid url", async () => {
    const res = await POST(req("POST", { url: "not-a-url", title: "Bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing title", async () => {
    const res = await POST(req("POST", { url: "https://example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const r = new NextRequest(BASE, { method: "POST", body: "not-json" });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });
});

describe("GET /bookmarks — list", () => {
  beforeEach(async () => {
    await POST(req("POST", { url: "https://a.com", title: "Alpha", tags: ["dev"] }));
    await POST(req("POST", { url: "https://b.com", title: "Beta", description: "search me", tags: ["news"] }));
    await POST(req("POST", { url: "https://c.com", title: "Gamma", tags: ["dev", "news"] }));
  });

  it("returns all bookmarks", async () => {
    const res = await GET(req("GET"));
    const { bookmarks, count } = await res.json();
    expect(count).toBe(3);
    expect(bookmarks).toHaveLength(3);
  });

  it("filters by tag", async () => {
    const res = await GET(new NextRequest(`${BASE}?tag=dev`));
    const { bookmarks } = await res.json();
    expect(bookmarks).toHaveLength(2);
    bookmarks.forEach((b: { tags: string[] }) => expect(b.tags).toContain("dev"));
  });

  it("searches by title", async () => {
    const res = await GET(new NextRequest(`${BASE}?q=alpha`));
    const { bookmarks } = await res.json();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe("Alpha");
  });

  it("searches by description", async () => {
    const res = await GET(new NextRequest(`${BASE}?q=search+me`));
    const { bookmarks } = await res.json();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe("Beta");
  });

  it("sorts by title ascending", async () => {
    const res = await GET(new NextRequest(`${BASE}?sort=title`));
    const { bookmarks } = await res.json();
    expect(bookmarks[0].title).toBe("Alpha");
    expect(bookmarks[1].title).toBe("Beta");
    expect(bookmarks[2].title).toBe("Gamma");
  });

  it("returns 400 for invalid sort", async () => {
    const res = await GET(new NextRequest(`${BASE}?sort=invalid`));
    expect(res.status).toBe(400);
  });
});

describe("GET /bookmarks/[id]", () => {
  it("returns a single bookmark", async () => {
    const createRes = await POST(req("POST", { url: "https://x.com", title: "X" }));
    const { bookmark } = await createRes.json();
    const res = await GET_ID(req("GET", undefined, `${BASE}/${bookmark.id}`), idCtx(bookmark.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmark.id).toBe(bookmark.id);
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET_ID(req("GET", undefined, `${BASE}/nonexistent`), idCtx("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /bookmarks/[id]", () => {
  it("updates title and tags", async () => {
    const { bookmark } = await (await POST(req("POST", { url: "https://x.com", title: "Old" }))).json();
    const res = await PATCH(
      req("PATCH", { title: "New", tags: ["updated"] }, `${BASE}/${bookmark.id}`),
      idCtx(bookmark.id)
    );
    expect(res.status).toBe(200);
    const { bookmark: updated } = await res.json();
    expect(updated.title).toBe("New");
    expect(updated.tags).toEqual(["updated"]);
    expect(updated.updated_at).not.toBe(bookmark.updated_at);
  });

  it("returns 404 for unknown id", async () => {
    const res = await PATCH(req("PATCH", { title: "X" }, `${BASE}/nope`), idCtx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid url in patch", async () => {
    const { bookmark } = await (await POST(req("POST", { url: "https://x.com", title: "T" }))).json();
    const res = await PATCH(
      req("PATCH", { url: "bad-url" }, `${BASE}/${bookmark.id}`),
      idCtx(bookmark.id)
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /bookmarks/[id]", () => {
  it("deletes an existing bookmark", async () => {
    const { bookmark } = await (await POST(req("POST", { url: "https://x.com", title: "T" }))).json();
    const res = await DELETE(req("DELETE", undefined, `${BASE}/${bookmark.id}`), idCtx(bookmark.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  it("returns 404 when deleting non-existent", async () => {
    const res = await DELETE(req("DELETE", undefined, `${BASE}/ghost`), idCtx("ghost"));
    expect(res.status).toBe(404);
  });

  it("cannot get after delete", async () => {
    const { bookmark } = await (await POST(req("POST", { url: "https://x.com", title: "T" }))).json();
    await DELETE(req("DELETE", undefined, `${BASE}/${bookmark.id}`), idCtx(bookmark.id));
    const res = await GET_ID(req("GET", undefined, `${BASE}/${bookmark.id}`), idCtx(bookmark.id));
    expect(res.status).toBe(404);
  });
});
