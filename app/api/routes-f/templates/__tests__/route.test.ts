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
  ensureTemplatesSchema: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../templates/_lib/db", () => ({
  ensureTemplatesSchema: jest.fn().mockResolvedValue(undefined),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const TEMPLATE_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f templates", () => {
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

  it("lists saved templates for the authenticated creator", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ id: TEMPLATE_ID, name: "Default setup" }],
    });

    const res = await GET(makeRequest("GET", "/api/routes-f/templates"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.templates).toHaveLength(1);
  });

  it("rejects creating more than 10 templates", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ template_count: 10 }],
    });

    const res = await POST(
      makeRequest("POST", "/api/routes-f/templates", {
        name: "Default setup",
        title: "My stream",
        category: "Tech",
        tags: ["nextjs"],
        description: "Test",
      })
    );

    expect(res.status).toBe(409);
  });

  it("updates a template", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: TEMPLATE_ID,
            name: "Default setup",
            title: "Old title",
            category: "Tech",
            tags: ["nextjs"],
            description: "Old",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: TEMPLATE_ID,
            user_id: "user-id",
            name: "Default setup",
            title: "New title",
            category: "Tech",
            tags: ["nextjs"],
            description: "Old",
            created_at: "2026-03-28T00:00:00Z",
            updated_at: "2026-03-28T01:00:00Z",
          },
        ],
      });

    const res = await PATCH(
      makeRequest("PATCH", `/api/routes-f/templates/${TEMPLATE_ID}`, {
        title: "New title",
      }),
      { params: Promise.resolve({ id: TEMPLATE_ID }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("New title");
  });

  it("deletes a template", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [{ id: TEMPLATE_ID }] });

    const res = await DELETE(
      makeRequest("DELETE", `/api/routes-f/templates/${TEMPLATE_ID}`),
      { params: Promise.resolve({ id: TEMPLATE_ID }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });
});
