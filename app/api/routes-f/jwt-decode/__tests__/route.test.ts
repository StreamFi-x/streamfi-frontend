import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/jwt-decode", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Helper to create a valid JWT (without verification, just base64 encoding)
function createTestJwt(header: object, payload: object, signature: string = "test-signature") {
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe("POST /api/routes-f/jwt-decode", () => {
  describe("valid tokens", () => {
    it("decodes valid JWT with standard claims", async () => {
      const token = createTestJwt(
        { alg: "HS256", typ: "JWT" },
        {
          iss: "issuer",
          sub: "subject",
          aud: "audience",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.header).toEqual({ alg: "HS256", typ: "JWT" });
      expect(body.payload.iss).toBe("issuer");
      expect(body.payload.sub).toBe("subject");
      expect(body.signature).toBe("test-signature");
    });

    it("includes warnings array", async () => {
      const token = createTestJwt(
        { alg: "HS256" },
        { test: "payload" }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.warnings)).toBe(true);
    });

    it("warns that signature is not verified", async () => {
      const token = createTestJwt(
        { alg: "HS256" },
        { test: "payload" }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.warnings.some((w: string) => w.includes("NOT verified"))).toBe(true);
    });
  });

  describe("expiration detection", () => {
    it("warns when token is expired", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createTestJwt(
        { alg: "HS256" },
        { exp: pastTime }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.warnings.some((w: string) => w.includes("expired"))).toBe(true);
    });

    it("does not warn for future expiration", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const token = createTestJwt(
        { alg: "HS256" },
        { exp: futureTime }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      const expiredWarning = body.warnings.filter((w: string) => w.includes("expired"));
      expect(expiredWarning.length).toBe(0);
    });

    it("handles missing exp claim gracefully", async () => {
      const token = createTestJwt(
        { alg: "HS256" },
        { test: "payload" }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.warnings).toBeDefined();
    });
  });

  describe("missing standard claims", () => {
    it("warns about missing claims", async () => {
      const token = createTestJwt(
        { alg: "HS256" },
        { minimal: "payload" }
      );

      const res = await POST(makeReq({ token }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.warnings.some((w: string) => w.includes("Missing standard claims"))).toBe(true);
    });
  });

  describe("malformed tokens", () => {
    it("returns 400 for token with wrong segment count", async () => {
      const res = await POST(makeReq({ token: "two.segments" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("returns 400 for token with too many segments", async () => {
      const res = await POST(makeReq({ token: "one.two.three.four" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid base64 in header", async () => {
      const res = await POST(makeReq({ token: "!!!invalid.aGVhZGVy.c2lnIg==" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid base64 in payload", async () => {
      const res = await POST(makeReq({ token: "aGVhZGVy.!!!invalid.c2lnIg==" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-JSON header", async () => {
      const invalidHeader = Buffer.from("not json").toString("base64");
      const validPayload = Buffer.from('{}').toString("base64");
      const res = await POST(makeReq({ token: `${invalidHeader}.${validPayload}.sig` }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-JSON payload", async () => {
      const validHeader = Buffer.from('{}').toString("base64");
      const invalidPayload = Buffer.from("not json").toString("base64");
      const res = await POST(makeReq({ token: `${validHeader}.${invalidPayload}.sig` }));
      expect(res.status).toBe(400);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing token", async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for empty token", async () => {
      const res = await POST(makeReq({ token: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-string token", async () => {
      const res = await POST(makeReq({ token: 123 }));
      expect(res.status).toBe(400);
    });
  });
});
