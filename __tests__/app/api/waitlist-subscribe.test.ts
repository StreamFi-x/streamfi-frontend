import { NextRequest } from "next/server";

const mockSql = jest.fn();
const mockSendWelcomeEmail = jest.fn();

jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock("../../../utils/send-email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

import { POST } from "../../../app/api/waitlist/subscribe/route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/waitlist/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist/subscribe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendWelcomeEmail.mockResolvedValue(undefined);
  });

  it("clears the stored name when resubscribing with name: null without COALESCE", async () => {
    mockSql
      .mockResolvedValueOnce({
        rows: [{ unsubscribed_at: "2026-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({ email: "user@example.com", name: null })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(2);

    const [strings, ...values] = mockSql.mock.calls[1];
    const queryText = (strings as string[]).join("$?");
    expect(queryText).toMatch(/UPDATE subscribers/i);
    expect(queryText).not.toMatch(/COALESCE/i);
    expect(values).toEqual([null, "user@example.com"]);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith("user@example.com", "");
  });

  it("clears the stored name when resubscribing with an empty string", async () => {
    mockSql
      .mockResolvedValueOnce({
        rows: [{ unsubscribed_at: "2026-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({ email: "user@example.com", name: "" })
    );

    expect(res.status).toBe(201);
    const [, ...values] = mockSql.mock.calls[1];
    expect(values).toEqual([null, "user@example.com"]);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith("user@example.com", "");
  });

  it("clears the stored name when resubscribing with whitespace-only name", async () => {
    mockSql
      .mockResolvedValueOnce({
        rows: [{ unsubscribed_at: "2026-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({ email: "user@example.com", name: "   " })
    );

    expect(res.status).toBe(201);
    const [, ...values] = mockSql.mock.calls[1];
    expect(values).toEqual([null, "user@example.com"]);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith("user@example.com", "");
  });

  it("sets name to null when resubscribing with name omitted", async () => {
    mockSql
      .mockResolvedValueOnce({
        rows: [{ unsubscribed_at: "2026-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(createRequest({ email: "user@example.com" }));

    expect(res.status).toBe(201);
    const [, ...values] = mockSql.mock.calls[1];
    expect(values).toEqual([null, "user@example.com"]);
  });

  it("updates the stored name to the trimmed value when resubscribing with a new name", async () => {
    mockSql
      .mockResolvedValueOnce({
        rows: [{ unsubscribed_at: "2026-01-01T00:00:00Z" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({ email: "user@example.com", name: "  Alice  " })
    );

    expect(res.status).toBe(201);
    const [, ...values] = mockSql.mock.calls[1];
    expect(values).toEqual(["Alice", "user@example.com"]);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      "user@example.com",
      "Alice"
    );
  });

  it("inserts a new subscriber with normalized name", async () => {
    mockSql
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      createRequest({ email: "new@example.com", name: "  Bob  " })
    );

    expect(res.status).toBe(201);
    const [strings, ...values] = mockSql.mock.calls[1];
    expect((strings as string[]).join("$?")).toMatch(
      /INSERT INTO subscribers/i
    );
    expect(values).toEqual(["new@example.com", "Bob"]);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith("new@example.com", "Bob");
  });

  it("returns alreadySubscribed when an active subscriber submits again", async () => {
    mockSql.mockResolvedValueOnce({
      rows: [{ unsubscribed_at: null }],
    });

    const res = await POST(
      createRequest({ email: "active@example.com", name: "Active" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alreadySubscribed).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email or missing email", async () => {
    const missingRes = await POST(createRequest({}));
    expect(missingRes.status).toBe(400);

    const invalidRes = await POST(createRequest({ email: "not-an-email" }));
    expect(invalidRes.status).toBe(400);
  });

  it("returns 500 when the database throws an error", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSql.mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await POST(createRequest({ email: "user@example.com" }));
    expect(res.status).toBe(500);

    consoleSpy.mockRestore();
  });
});
