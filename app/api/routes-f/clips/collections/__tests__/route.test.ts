jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

jest.mock("../_lib/db", () => ({
  ensureClipCollectionsSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";
import { GET as GET_BY_ID, PATCH, DELETE } from "../[id]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

const SESSION = {
  ok: true as const,
  userId: "creator-id",
  wallet: null,
  privyId: "did:privy:abc",
  username: "creator",
  email: "creator@example.com",
};

const COLLECTION_ID = "550e8400-e29b-41d4-a716-446655440000";
const CLIP_ID = "660e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f clips collections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue(SESSION);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists public clip collections for a creator", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: COLLECTION_ID,
          name: "Best clips",
          creator_username: "creator",
          clip_count: 2,
        },
      ],
    });

    const res = await GET(
      makeRequest("GET", "/api/routes-f/clips/collections?creator=creator")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.collections[0].name).toBe("Best clips");
  });

  it("creates a clip collection", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ collection_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: CLIP_ID }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: COLLECTION_ID,
            creator_id: "creator-id",
            name: "Best clips",
            description: null,
            created_at: "2026-03-30T00:00:00Z",
            updated_at: "2026-03-30T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/clips/collections", {
        name: "Best clips",
        clip_ids: [CLIP_ID],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.clip_count).toBe(1);
  });

  it("returns a collection with ordered clips", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: COLLECTION_ID,
            creator_id: "creator-id",
            name: "Best clips",
            description: null,
            created_at: "2026-03-30T00:00:00Z",
            updated_at: "2026-03-30T00:00:00Z",
            creator_username: "creator",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ position: 0, id: CLIP_ID, title: "Clip one" }],
      });

    const res = await GET_BY_ID(
      makeRequest("GET", `/api/routes-f/clips/collections/${COLLECTION_ID}`),
      { params: { id: COLLECTION_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.clips[0].position).toBe(0);
  });

  it("updates clip order in a collection", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: COLLECTION_ID,
            creator_id: "creator-id",
            name: "Best clips",
            description: null,
            created_at: "2026-03-30T00:00:00Z",
            updated_at: "2026-03-30T00:00:00Z",
            creator_username: "creator",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: CLIP_ID }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: COLLECTION_ID,
            creator_id: "creator-id",
            name: "Updated clips",
            description: null,
            created_at: "2026-03-30T00:00:00Z",
            updated_at: "2026-03-30T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ position: 0, id: CLIP_ID, title: "Clip one" }],
      });

    const res = await PATCH(
      makeRequest("PATCH", `/api/routes-f/clips/collections/${COLLECTION_ID}`, {
        name: "Updated clips",
        clip_ids: [CLIP_ID],
      }),
      { params: { id: COLLECTION_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Updated clips");
  });

  it("deletes a clip collection", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: COLLECTION_ID }] });

    const res = await DELETE(
      makeRequest("DELETE", `/api/routes-f/clips/collections/${COLLECTION_ID}`),
      { params: { id: COLLECTION_ID } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
