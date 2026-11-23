/**
 * @jest-environment node
 *
 * #1727: waitlist subscription requires double opt-in confirmation before
 * treating an email address as subscribed.
 * #1728: waitlist unsubscribe requires a per-subscriber verification token,
 * not just knowledge of the email address.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));

const mockSendWelcomeEmail = jest.fn();
jest.mock("@/utils/send-email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

import { POST as subscribePOST } from "@/app/api/waitlist/subscribe/route";
import {
  GET as confirmGET,
  POST as confirmPOST,
} from "@/app/api/waitlist/confirm/route";
import {
  GET as unsubscribeGET,
  POST as unsubscribePOST,
} from "@/app/api/waitlist/unsubscribe/route";
import { WaitlistConfirmation } from "@/components/templates/WaitlistConfirm";

function makeJsonRequest(
  url: string,
  body: unknown,
  method: "POST" = "POST"
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist/subscribe (#1727)", () => {
  beforeEach(() => {
    mockDb.reset();
    mockSendWelcomeEmail.mockReset();
    mockSendWelcomeEmail.mockResolvedValue(true);
  });

  it("rejects invalid JSON bodies with 400", async () => {
    const req = new NextRequest("http://localhost/api/waitlist/subscribe", {
      method: "POST",
      body: "{bad-json",
    });

    const res = await subscribePOST(req);
    expect(res.status).toBe(400);
    expect(mockDb.calls).toHaveLength(0);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("rejects missing or malformed emails with 400", async () => {
    const missing = await subscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/subscribe", {})
    );
    expect(missing.status).toBe(400);

    const invalid = await subscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/subscribe", {
        email: "not-an-email",
      })
    );
    expect(invalid.status).toBe(400);
    expect(mockDb.calls).toHaveLength(0);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("inserts a pending unconfirmed subscriber and emails confirmation and unsubscribe tokens", async () => {
    mockDb.once(/SELECT/i, { rows: [] });
    mockDb.once(/INSERT/i, { rows: [], rowCount: 1 });

    const res = await subscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/subscribe", {
        email: "Alice@Example.com",
        name: "Alice",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.pendingConfirmation).toBe(true);

    expect(mockDb.calls).toHaveLength(2);
    const insertCall = mockDb.calls[1];
    expect(insertCall.text).toMatch(/INSERT INTO subscribers/i);
    expect(insertCall.text).toMatch(/confirmed_at/i);
    expect(insertCall.values[0]).toBe("alice@example.com");
    expect(insertCall.values[1]).toBe("Alice");
    const confirmationToken = insertCall.values[2] as string;
    const unsubscribeToken = insertCall.values[3] as string;
    expect(typeof confirmationToken).toBe("string");
    expect(confirmationToken.length).toBeGreaterThanOrEqual(32);
    expect(typeof unsubscribeToken).toBe("string");
    expect(unsubscribeToken.length).toBeGreaterThanOrEqual(32);
    expect(confirmationToken).not.toBe(unsubscribeToken);

    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      "alice@example.com",
      "Alice",
      {
        confirmationToken,
        unsubscribeToken,
      }
    );
  });

  it("treats an unconfirmed existing subscriber as pending and sends a fresh confirmation link", async () => {
    mockDb.once(/SELECT/i, {
      rows: [
        {
          confirmed_at: null,
          unsubscribed_at: null,
          unsubscribe_token: "existing-unsub-token-1234567890",
        },
      ],
    });
    mockDb.once(/UPDATE/i, { rows: [], rowCount: 1 });

    const res = await subscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/subscribe", {
        email: "pending@example.com",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.pendingConfirmation).toBe(true);
    expect(body.alreadySubscribed).toBeUndefined();
    expect(mockDb.calls[1].text).toMatch(/UPDATE subscribers/i);
    expect(mockDb.calls[1].text).toMatch(/confirmed_at = NULL/i);
    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("returns alreadySubscribed only when the subscriber is both confirmed and not unsubscribed", async () => {
    mockDb.once(/SELECT/i, {
      rows: [
        {
          confirmed_at: new Date().toISOString(),
          unsubscribed_at: null,
          unsubscribe_token: "token",
        },
      ],
    });

    const res = await subscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/subscribe", {
        email: "confirmed@example.com",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadySubscribed).toBe(true);
    expect(mockDb.calls).toHaveLength(1);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("requires a new double opt-in confirmation when a previously unsubscribed user resubscribes", async () => {
    mockDb.once(/SELECT/i, {
      rows: [
        {
          confirmed_at: "2026-01-01T00:00:00Z",
          unsubscribed_at: "2026-02-01T00:00:00Z",
          unsubscribe_token: "old-unsub-token",
        },
      ],
    });
    mockDb.once(/UPDATE/i, { rows: [], rowCount: 1 });

    const res = await subscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/subscribe", {
        email: "returning@example.com",
        name: "Returning",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.pendingConfirmation).toBe(true);
    const updateCall = mockDb.calls[1];
    expect(updateCall.text).toMatch(/confirmed_at = NULL/i);
    expect(updateCall.text).toMatch(/unsubscribed_at = NULL/i);
    // Rotates unsubscribe token on re-subscription
    expect(updateCall.values[2]).not.toBe("old-unsub-token");
  });
});

describe("GET & POST /api/waitlist/confirm (#1727)", () => {
  const validToken = "a".repeat(64);

  beforeEach(() => {
    mockDb.reset();
  });

  it("rejects missing email or token with 400", async () => {
    const res1 = await confirmGET(
      new Request("http://localhost/api/waitlist/confirm?email=a@b.com")
    );
    expect(res1.status).toBe(400);

    const res2 = await confirmPOST(
      makeJsonRequest("http://localhost/api/waitlist/confirm", {
        token: validToken,
      })
    );
    expect(res2.status).toBe(400);
    expect(mockDb.calls).toHaveLength(0);
  });

  it("rejects unknown email or mismatched confirmation token with 400", async () => {
    mockDb.once(/SELECT/i, {
      rows: [{ confirmation_token: validToken, confirmed_at: null }],
    });

    const res = await confirmGET(
      new Request(
        `http://localhost/api/waitlist/confirm?email=user@example.com&token=wrong-token`
      )
    );
    expect(res.status).toBe(400);
    expect(mockDb.calls).toHaveLength(1);
  });

  it("marks the subscriber confirmed and clears confirmation_token on a valid confirmation link", async () => {
    mockDb.once(/SELECT/i, {
      rows: [{ confirmation_token: validToken, confirmed_at: null }],
    });
    mockDb.once(/UPDATE/i, { rows: [], rowCount: 1 });

    const res = await confirmGET(
      new Request(
        `http://localhost/api/waitlist/confirm?email=user@example.com&token=${validToken}`
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.confirmed).toBe(true);
    expect(mockDb.calls).toHaveLength(2);
    expect(mockDb.calls[1].text).toMatch(
      /SET confirmed_at = CURRENT_TIMESTAMP/i
    );
    expect(mockDb.calls[1].text).toMatch(/confirmation_token = NULL/i);
  });

  it("also accepts confirmation via POST", async () => {
    mockDb.once(/SELECT/i, {
      rows: [{ confirmation_token: validToken, confirmed_at: null }],
    });
    mockDb.once(/UPDATE/i, { rows: [], rowCount: 1 });

    const res = await confirmPOST(
      makeJsonRequest("http://localhost/api/waitlist/confirm", {
        email: "user@example.com",
        token: validToken,
      })
    );
    expect(res.status).toBe(200);
  });
});

describe("POST & GET /api/waitlist/unsubscribe (#1728)", () => {
  const unsubToken = "u".repeat(64);

  beforeEach(() => {
    mockDb.reset();
  });

  it("rejects unsubscribe requests that supply only an email address without a token (#1728)", async () => {
    const postRes = await unsubscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/unsubscribe", {
        email: "victim@example.com",
      })
    );
    expect(postRes.status).toBe(400);
    expect((await postRes.json()).error).toMatch(/token/i);

    const getRes = await unsubscribeGET(
      new Request(
        "http://localhost/api/waitlist/unsubscribe?email=victim@example.com"
      )
    );
    expect(getRes.status).toBe(400);
    expect(mockDb.calls).toHaveLength(0);
  });

  it("rejects unsubscribe requests when the token does not match the subscriber's token (#1728)", async () => {
    mockDb.once(/SELECT/i, {
      rows: [{ unsubscribe_token: unsubToken }],
    });

    const res = await unsubscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/unsubscribe", {
        email: "victim2@example.com",
        token: "forged-token",
      })
    );

    expect(res.status).toBe(403);
    expect(mockDb.calls).toHaveLength(1);
  });

  it("returns 404 when the email is not found or already unsubscribed", async () => {
    mockDb.once(/SELECT/i, { rows: [] });

    const res = await unsubscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/unsubscribe", {
        email: "missing@example.com",
        token: unsubToken,
      })
    );

    expect(res.status).toBe(404);
  });

  it("unsubscribes the subscriber when both email and matching verification token are provided", async () => {
    mockDb.once(/SELECT/i, {
      rows: [{ unsubscribe_token: unsubToken }],
    });
    mockDb.once(/UPDATE/i, { rows: [], rowCount: 1 });

    const res = await unsubscribePOST(
      makeJsonRequest("http://localhost/api/waitlist/unsubscribe", {
        email: "member@example.com",
        token: unsubToken,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Successfully unsubscribed");
    expect(mockDb.calls).toHaveLength(2);
    expect(mockDb.calls[1].text).toMatch(/UPDATE subscribers/i);
    expect(mockDb.calls[1].text).toMatch(/unsubscribed_at = NOW\(\)/i);
  });

  it("supports one-click GET unsubscribe links containing email and token", async () => {
    mockDb.once(/SELECT/i, {
      rows: [{ unsubscribe_token: unsubToken }],
    });
    mockDb.once(/UPDATE/i, { rows: [], rowCount: 1 });

    const res = await unsubscribeGET(
      new Request(
        `http://localhost/api/waitlist/unsubscribe?email=member2@example.com&token=${unsubToken}`
      )
    );
    expect(res.status).toBe(200);
  });
});

describe("WaitlistConfirmation email template (#1727, #1728)", () => {
  it("embeds both the double opt-in confirmation link and the token-authenticated unsubscribe link", () => {
    const html = WaitlistConfirmation("Alice", "alice@example.com", {
      confirmationToken: "confirm-tok-123",
      unsubscribeToken: "unsub-tok-456",
      baseUrl: "https://streamfi.xyz",
    });

    expect(html).toContain(
      "https://streamfi.xyz/api/waitlist/confirm?email=alice%40example.com&token=confirm-tok-123"
    );
    expect(html).toContain(
      "https://streamfi.xyz/api/waitlist/unsubscribe?email=alice%40example.com&token=unsub-tok-456"
    );
  });
});
