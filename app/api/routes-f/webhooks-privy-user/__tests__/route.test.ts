/**
 * @jest-environment node
 */
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const SECRET = "whsec_" + Buffer.from("test-signing-secret-key").toString("base64");

function sign(svixId: string, svixTimestamp: string, body: string, secret = SECRET): string {
  const keyBytes = Buffer.from(secret.slice(6), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const sig = createHmac("sha256", keyBytes).update(signedContent).digest("base64");
  return `v1,${sig}`;
}

function makeRequest(
  body: unknown,
  opts: { sign?: boolean; svixId?: string; timestamp?: number; rawBody?: string } = {}
): NextRequest {
  const rawBody = opts.rawBody ?? JSON.stringify(body);
  const svixId = opts.svixId ?? "msg_test_1";
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "svix-id": svixId,
    "svix-timestamp": timestamp,
  };

  if (opts.sign !== false) {
    headers["svix-signature"] = sign(svixId, timestamp, rawBody);
  }

  return new NextRequest("http://localhost/api/routes-f/webhooks-privy-user", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/routes-f/webhooks-privy-user", () => {
  const originalSecret = process.env.PRIVY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.PRIVY_WEBHOOK_SECRET = SECRET;
    jest.resetModules();
  });

  afterAll(() => {
    process.env.PRIVY_WEBHOOK_SECRET = originalSecret;
  });

  it("processes a user.created event with a valid signature", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({
      type: "user.created",
      user: { id: "did:privy:abc123", email: { address: "a@example.com" } },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(body.event).toBe("user.created");
  });

  it("processes a wallet linked event and records the wallet address", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({
      type: "user.wallet.created",
      user: {
        id: "did:privy:wallet1",
        wallet: { address: "GABC123", chain_type: "stellar" },
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("rejects a request with an invalid signature", async () => {
    const { POST } = await import("../route");
    const body = { type: "user.created", user: { id: "did:privy:bad" } };
    const raw = JSON.stringify(body);
    const svixId = "msg_bad";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const req = new NextRequest("http://localhost/api/routes-f/webhooks-privy-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": timestamp,
        "svix-signature": "v1,not-a-real-signature==",
      },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects a request missing signature headers", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(
      { type: "user.created", user: { id: "did:privy:nosig" } },
      { sign: false }
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects a request with a stale timestamp (replay protection)", async () => {
    const { POST } = await import("../route");
    const staleTimestamp = Math.floor(Date.now() / 1000) - 10 * 60; // 10 min old
    const req = makeRequest(
      { type: "user.created", user: { id: "did:privy:stale" } },
      { timestamp: staleTimestamp }
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when PRIVY_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.PRIVY_WEBHOOK_SECRET;
    const { POST } = await import("../route");
    const req = makeRequest({ type: "user.created", user: { id: "did:privy:x" } });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 for malformed JSON body", async () => {
    const { POST } = await import("../route");
    const raw = "not json";
    const svixId = "msg_malformed";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const req = new NextRequest("http://localhost/api/routes-f/webhooks-privy-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": timestamp,
        "svix-signature": sign(svixId, timestamp, raw),
      },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a valid-signature payload missing user.id", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({ type: "user.created", user: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("acknowledges but no-ops an unhandled event type", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({
      type: "user.some_future_event",
      user: { id: "did:privy:future" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("is idempotent for a redelivered event (same svix-id)", async () => {
    const { POST } = await import("../route");
    const payload = { type: "user.updated", user: { id: "did:privy:dup" } };
    const raw = JSON.stringify(payload);
    const svixId = "msg_dup_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = sign(svixId, timestamp, raw);

    const req1 = new NextRequest("http://localhost/api/routes-f/webhooks-privy-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": timestamp,
        "svix-signature": sig,
      },
      body: raw,
    });
    const req2 = new NextRequest("http://localhost/api/routes-f/webhooks-privy-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": timestamp,
        "svix-signature": sig,
      },
      body: raw,
    });

    const res1 = await POST(req1);
    const res2 = await POST(req2);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("accepts a signature when svix-signature carries multiple candidates", async () => {
    const { POST } = await import("../route");
    const payload = { type: "user.created", user: { id: "did:privy:multi" } };
    const raw = JSON.stringify(payload);
    const svixId = "msg_multi";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const validSig = sign(svixId, timestamp, raw);
    const req = new NextRequest("http://localhost/api/routes-f/webhooks-privy-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": timestamp,
        "svix-signature": `v1,bogussignature== ${validSig}`,
      },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/routes-f/webhooks-privy-user", () => {
  it("returns a health check payload", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
