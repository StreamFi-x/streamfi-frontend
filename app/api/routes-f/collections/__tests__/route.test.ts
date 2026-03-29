jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureCollectionsSchema: jest.fn().mockResolvedValue(undefined),
  COLLECTION_VISIBILITIES: ["public", "private"],
  COLLECTION_ITEM_TYPES: ["clip", "recording"],
}));

jest.mock("../../collections/_lib/db", () => ({
  ensureCollectionsSchema: jest.fn().mockResolvedValue(undefined),
  COLLECTION_VISIBILITIES: ["public", "private"],
  COLLECTION_ITEM_TYPES: ["clip", "recording"],
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";
import { DELETE as DELETE_COLLECTION } from "../[id]/route";
import { POST as ADD_ITEM } from "../[id]/items/route";
import { DELETE as DELETE_ITEM } from "../[id]/items/[itemId]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const COLLECTION_ID = "550e8400-e29b-41d4-a716-446655440000";
const ITEM_ID = "550e8400-e29b-41d4-a716-446655440001";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f collections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-id",
      wallet: null,
      privyId: "did:privy:abc",
      username: "alice",
      email: "alice@example.com",
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists public collections for a creator profile", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: COLLECTION_ID,
          name: "Best moments",
          visibility: "public",
          username: "alice",
          item_count: 4,
        },
      ],
    });

    const res = await GET(
      makeRequest("GET", "/api/routes-f/collections?creator=alice")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.collections).toHaveLength(1);
    expect(json.collections[0].visibility).toBe("public");
  });

  it("rejects creating more than 20 collections", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ collection_count: 20 }] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/collections", {
        name: "Playlist",
        visibility: "private",
      })
    );

    expect(res.status).toBe(409);
  });

  it("creates a collection", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ collection_count: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: COLLECTION_ID,
            user_id: "user-id",
            name: "Playlist",
            visibility: "public",
            created_at: "2026-03-27T00:00:00Z",
            updated_at: "2026-03-27T00:00:00Z",
          },
        ],
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/collections", {
        name: "Playlist",
        visibility: "public",
      })
    );

    expect(res.status).toBe(201);
  });

  it("rejects adding items once a collection has 50 items", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: COLLECTION_ID }] })
      .mockResolvedValueOnce({ rows: [{ item_count: 50 }] });

    const res = await ADD_ITEM(
      makeRequest("POST", `/api/routes-f/collections/${COLLECTION_ID}/items`, {
        item_id: ITEM_ID,
        item_type: "clip",
      }),
      { params: { id: COLLECTION_ID } }
    );

    expect(res.status).toBe(409);
  });

  it("adds an item to a collection", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: COLLECTION_ID }] })
      .mockResolvedValueOnce({ rows: [{ item_count: 3 }] })
      .mockResolvedValueOnce({
        rows: [
          { id: ITEM_ID, title: "Clip", playback_id: "p", status: "ready" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            collection_id: COLLECTION_ID,
            item_id: ITEM_ID,
            item_type: "clip",
            created_at: "2026-03-27T00:00:00Z",
          },
        ],
      });

    const res = await ADD_ITEM(
      makeRequest("POST", `/api/routes-f/collections/${COLLECTION_ID}/items`, {
        item_id: ITEM_ID,
        item_type: "clip",
      }),
      { params: { id: COLLECTION_ID } }
    );

    expect(res.status).toBe(201);
  });

  it("removes an item from a collection", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: COLLECTION_ID }] })
      .mockResolvedValueOnce({ rows: [{ item_id: ITEM_ID }] });

    const res = await DELETE_ITEM(
      makeRequest(
        "DELETE",
        `/api/routes-f/collections/${COLLECTION_ID}/items/${ITEM_ID}`
      ),
      { params: { id: COLLECTION_ID, itemId: ITEM_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });

  it("deletes a collection", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: COLLECTION_ID }] });

    const res = await DELETE_COLLECTION(
      makeRequest("DELETE", `/api/routes-f/collections/${COLLECTION_ID}`),
      { params: { id: COLLECTION_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
