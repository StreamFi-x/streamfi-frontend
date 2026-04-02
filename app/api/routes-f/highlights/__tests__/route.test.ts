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
  ensureHighlightsSchema: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../highlights/_lib/db", () => ({
  ensureHighlightsSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";
import { DELETE } from "../[id]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const RECORDING_ID = "550e8400-e29b-41d4-a716-446655440000";
const HIGHLIGHT_ID = "550e8400-e29b-41d4-a716-446655440001";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f highlights", () => {
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

  it("lists the authenticated creator's highlights", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [
        {
          id: HIGHLIGHT_ID,
          recording_id: RECORDING_ID,
          title: "Big moment",
        },
      ],
    });

    const res = await GET(makeRequest("GET", "/api/routes-f/highlights"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.highlights).toHaveLength(1);
  });

  it("rejects clips longer than 90 seconds", async () => {
    const res = await POST(
      makeRequest("POST", "/api/routes-f/highlights", {
        recording_id: RECORDING_ID,
        start_offset: 0,
        end_offset: 91,
        title: "Too long",
      })
    );

    expect(res.status).toBe(400);
  });

  it("creates a highlight with a playback URL", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: RECORDING_ID,
            user_id: "user-id",
            playback_id: "mux-playback",
            duration: 180,
            title: "Recording",
            status: "ready",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: HIGHLIGHT_ID,
            recording_id: RECORDING_ID,
            user_id: "user-id",
            title: "Big moment",
            start_offset: 5,
            end_offset: 45,
            playback_url:
              "https://stream.mux.com/mux-playback.m3u8?asset_type=clip&start=5&end=45",
            created_at: "2026-03-28T00:00:00Z",
          },
        ],
      });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/highlights", {
        recording_id: RECORDING_ID,
        start_offset: 5,
        end_offset: 45,
        title: "Big moment",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.playback_url).toContain("asset_type=clip");
  });

  it("deletes a highlight owned by the current creator", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: HIGHLIGHT_ID }],
    });

    const res = await DELETE(
      makeRequest("DELETE", `/api/routes-f/highlights/${HIGHLIGHT_ID}`),
      { params: Promise.resolve({ id: HIGHLIGHT_ID }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
