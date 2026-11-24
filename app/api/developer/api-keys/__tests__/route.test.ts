/**
 * Developer API Keys route tests.
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

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { verifySession } from "@/lib/auth/verify-session";
import { _resetApiKeyMemoryStore } from "@/lib/api-keys";
import { GET, POST, DELETE } from "../route";
import { POST as ROTATE } from "../rotate/route";

const makeRequest = (method: string, body?: object, search?: string) =>
  new Request(`http://localhost/api/developer/api-keys${search ?? ""}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

const verifySessionMock = verifySession as unknown as jest.Mock;

describe("Developer API Keys Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetApiKeyMemoryStore();
    jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user-dev-1",
      wallet: "0xDEV1",
    });
  });

  describe("GET /api/developer/api-keys", () => {
    it("returns 401 when unauthenticated", async () => {
      verifySessionMock.mockResolvedValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      });

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(401);
    });

    it("returns keys list for authenticated user", async () => {
      // Create a key first
      await POST(makeRequest("POST", { name: "Existing Key", tier: "free" }));

      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.keys).toHaveLength(1);
      expect(data.keys[0].name).toBe("Existing Key");
    });
  });

  describe("POST /api/developer/api-keys", () => {
    it("returns 400 when name is missing", async () => {
      const res = await POST(makeRequest("POST", { tier: "free" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when tier is invalid", async () => {
      const res = await POST(makeRequest("POST", { name: "Test", tier: "super_tier" }));
      expect(res.status).toBe(400);
    });

    it("creates a key and returns the raw secret once", async () => {
      const res = await POST(makeRequest("POST", { name: "Bot Service", tier: "creator" }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.key).toMatch(/^sf_live_/);
      expect(data.apiKey.name).toBe("Bot Service");
      expect(data.apiKey.tier).toBe("creator");
    });
  });

  describe("DELETE /api/developer/api-keys", () => {
    it("returns 400 when id is missing", async () => {
      const res = await DELETE(makeRequest("DELETE", {}));
      expect(res.status).toBe(400);
    });

    it("returns 404 when key is not found", async () => {
      const res = await DELETE(makeRequest("DELETE", { id: "non-existent" }));
      expect(res.status).toBe(404);
    });

    it("revokes an existing key successfully", async () => {
      const createRes = await POST(makeRequest("POST", { name: "To Revoke", tier: "free" }));
      const createData = await createRes.json();
      const keyId = createData.apiKey.id;

      const delRes = await DELETE(makeRequest("DELETE", { id: keyId }));
      expect(delRes.status).toBe(200);

      const delData = await delRes.json();
      expect(delData.success).toBe(true);
    });
  });

  describe("POST /api/developer/api-keys/rotate", () => {
    it("returns 400 when id is missing", async () => {
      const res = await ROTATE(makeRequest("POST", {}));
      expect(res.status).toBe(400);
    });

    it("rotates an existing key immediately and returns a new secret", async () => {
      const createRes = await POST(makeRequest("POST", { name: "To Rotate", tier: "partner" }));
      const createData = await createRes.json();
      const oldKeyId = createData.apiKey.id;
      const oldRawKey = createData.key;

      const rotateRes = await ROTATE(makeRequest("POST", { id: oldKeyId }));
      expect(rotateRes.status).toBe(200);

      const rotateData = await rotateRes.json();
      expect(rotateData.key).toMatch(/^sf_live_/);
      expect(rotateData.key).not.toBe(oldRawKey);
      expect(rotateData.apiKey.name).toBe("To Rotate");
      expect(rotateData.apiKey.tier).toBe("partner");
    });
  });
});
