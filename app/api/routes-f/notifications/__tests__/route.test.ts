/**
 * Tests for GET /api/routes-f/notifications
 *
 * Seed data (in-memory — no mocks needed for data layer):
 *   viewer_001  12 notifications, 3 unread (n_001, n_002, n_004), newest → oldest
 *   viewer_002   3 notifications, 2 unread (n_101, n_102)
 *   unknown_viewer  → [] (empty inbox)
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET } from "../route";

// ── Helper ─────────────────────────────────────────────────────────────────────

const makeRequest = (search: string): import("next/server").NextRequest =>
  new Request(`http://localhost/api/routes-f/notifications${search}`) as unknown as import("next/server").NextRequest;

// ── Validation ─────────────────────────────────────────────────────────────────

describe("GET /api/routes-f/notifications — validation", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(JSON.stringify(body.issues)).toMatch(/viewer_id/i);
  });

  it("returns 400 when viewer_id is an empty string", async () => {
    const res = await GET(makeRequest("?viewer_id="));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when limit is below 1", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=0"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when limit exceeds 100", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=101"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });
});

// ── Unknown viewer ──────────────────────────────────────────────────────────────

describe("GET /api/routes-f/notifications — unknown viewer", () => {
  it("returns 200 with empty items for an unknown viewer_id", async () => {
    const res = await GET(makeRequest("?viewer_id=unknown_viewer"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
    expect(body.unread_count).toBe(0);
  });
});

// ── viewer_001 ─────────────────────────────────────────────────────────────────

describe("GET /api/routes-f/notifications — viewer_001 (12 notifications, 3 unread)", () => {
  it("returns first page with default limit (20) — all 12 items fit", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(12);
    expect(body.next_cursor).toBeNull();
    expect(body.unread_count).toBe(3);
  });

  it("items are sorted newest-first", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=3"));
    const { items } = await res.json();
    expect(items[0].id).toBe("n_001"); // 2026-06-26T10:00:00Z
    expect(items[1].id).toBe("n_002"); // 2026-06-26T09:45:00Z
    expect(items[2].id).toBe("n_003"); // 2026-06-26T09:00:00Z
  });

  it("returns next_cursor when a full page fits with more remaining", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.next_cursor).toBe("n_005"); // last item on page 1
    expect(body.unread_count).toBe(3);
  });

  it("cursor pagination returns the next page", async () => {
    // page 1
    const r1 = await GET(makeRequest("?viewer_id=viewer_001&limit=5"));
    const { next_cursor } = await r1.json();
    expect(next_cursor).toBeTruthy();

    // page 2 using cursor
    const r2 = await GET(makeRequest(`?viewer_id=viewer_001&limit=5&cursor=${next_cursor}`));
    expect(r2.status).toBe(200);
    const body2 = await r2.json();
    expect(body2.items).toHaveLength(5);
    expect(body2.items[0].id).toBe("n_006");
    expect(body2.next_cursor).toBe("n_010");
    expect(body2.unread_count).toBe(3); // always the full-viewer total
  });

  it("last page has null next_cursor", async () => {
    // page 3 of 3 (items 11–12)
    const r1 = await GET(makeRequest("?viewer_id=viewer_001&limit=5"));
    const { next_cursor: c1 } = await r1.json();
    const r2 = await GET(makeRequest(`?viewer_id=viewer_001&limit=5&cursor=${c1}`));
    const { next_cursor: c2 } = await r2.json();
    const r3 = await GET(makeRequest(`?viewer_id=viewer_001&limit=5&cursor=${c2}`));
    const body3 = await r3.json();
    expect(body3.items).toHaveLength(2); // n_011, n_012
    expect(body3.next_cursor).toBeNull();
    expect(body3.unread_count).toBe(3);
  });

  it("unread_count reflects total unread for viewer, not just the page", async () => {
    // page 1 with limit=1 — only n_001 returned (unread), but total unread is 3
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=1"));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.unread_count).toBe(3);
  });

  it("unknown cursor starts from the beginning", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=3&cursor=nonexistent_id"));
    const body = await res.json();
    // cursor not found → startIndex stays 0
    expect(body.items[0].id).toBe("n_001");
  });
});

// ── viewer_002 ─────────────────────────────────────────────────────────────────

describe("GET /api/routes-f/notifications — viewer_002 (3 notifications, 2 unread)", () => {
  it("returns all 3 items on a single page", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_002"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.next_cursor).toBeNull();
    expect(body.unread_count).toBe(2);
  });

  it("items are sorted newest-first", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_002"));
    const { items } = await res.json();
    expect(items[0].id).toBe("n_101");
    expect(items[1].id).toBe("n_102");
    expect(items[2].id).toBe("n_103");
  });

  it("cursor on last item yields empty next page", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_002&limit=10&cursor=n_103"));
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.next_cursor).toBeNull();
    expect(body.unread_count).toBe(2);
  });
});

// ── Response shape ──────────────────────────────────────────────────────────────

describe("GET /api/routes-f/notifications — response shape", () => {
  it("each notification has all required fields", async () => {
    const res = await GET(makeRequest("?viewer_id=viewer_001&limit=1"));
    const { items } = await res.json();
    const n = items[0];
    expect(typeof n.id).toBe("string");
    expect(typeof n.type).toBe("string");
    expect(typeof n.body).toBe("string");
    expect(typeof n.link).toBe("string");
    expect(typeof n.read).toBe("boolean");
    expect(typeof n.created_at).toBe("string");
  });
});
