/**
 * @jest-environment node
 *
 * Tests for Waitlist Unsubscribe Token Verification (#1728)
 */

const mockSql = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock("../../../../utils/rate-limit", () => ({
  rateLimit: () => ({
    check: jest.fn().mockResolvedValue(true),
  }),
}));

import { POST, generateUnsubscribeToken } from "@/app/api/waitlist/unsubscribe/route";

describe("Waitlist Unsubscribe Token Verification (#1728)", () => {
  beforeEach(() => {
    mockSql.mockReset();
  });

  it("returns 400 when verification token is missing", async () => {
    const req = new Request("http://localhost/api/waitlist/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("Verification token is required to unsubscribe");
  });

  it("returns 403 when verification token does not match subscriber", async () => {
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "sub-uuid-1", email: "user@example.com", unsubscribed_at: null }],
    });

    const req = new Request("http://localhost/api/waitlist/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", token: "invalid-token-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toBe("Invalid or unauthorized unsubscribe token");
  });

  it("returns 200 and updates unsubscribed_at when valid HMAC token is provided", async () => {
    const email = "user@example.com";
    const validToken = generateUnsubscribeToken(email);

    mockSql.mockResolvedValueOnce({
      rows: [{ id: "sub-uuid-1", email, unsubscribed_at: null }],
    });
    mockSql.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = new Request("http://localhost/api/waitlist/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token: validToken }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns 200 when subscriber id UUID is provided as token", async () => {
    const email = "user@example.com";
    const subId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    mockSql.mockResolvedValueOnce({
      rows: [{ id: subId, email, unsubscribed_at: null }],
    });
    mockSql.mockResolvedValueOnce({ rows: [] });

    const req = new Request("http://localhost/api/waitlist/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token: subId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
