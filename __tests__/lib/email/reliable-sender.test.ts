/**
 * @jest-environment node
 */
const mockSql = jest.fn();
const mockSendOperationalAlert = jest.fn().mockResolvedValue("logged");
const mockSendWelcomeEmail = jest.fn();
const mockAuthorizeAdmin = jest.fn();

jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock("@/lib/security/alerts", () => ({
  sendOperationalAlert: (...args: unknown[]) =>
    mockSendOperationalAlert(...args),
}));

jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/utils/send-email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

jest.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: (...args: unknown[]) => mockAuthorizeAdmin(...args),
}));

import { NextRequest } from "next/server";
import {
  executeEmailWithRetryAndDeadLetter,
  listEmailDeadLetters,
  getInMemoryEmailDeadLetters,
  clearInMemoryEmailDeadLettersForTests,
} from "@/lib/email/reliable-sender";
import { POST as waitlistSubscribe } from "@/app/api/waitlist/subscribe/route";
import { GET as getAdminEmailDeadLetters } from "@/app/api/admin/email-dead-letters/route";

describe("Transactional Email Retry and Dead-Letter Visibility (#1748)", () => {
  beforeEach(() => {
    mockSql.mockReset().mockResolvedValue({ rows: [{ id: 101 }] });
    mockSendOperationalAlert.mockClear();
    mockSendWelcomeEmail.mockReset();
    mockAuthorizeAdmin.mockReset();
    clearInMemoryEmailDeadLettersForTests();
  });

  it("succeeds on the first attempt without sleeping or dead-lettering", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const sendFn = jest.fn().mockResolvedValue({ messageId: "msg-1" });

    const outcome = await executeEmailWithRetryAndDeadLetter(sendFn, {
      emailType: "waitlist_welcome",
      recipientEmail: "user@example.com",
      subject: "Your StreamFi Waitlist Confirmation",
      maxRetries: 2,
      sleep,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.attempts).toBe(1);
    expect(outcome.deadLettered).toBe(false);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(getInMemoryEmailDeadLetters()).toHaveLength(0);
  });

  it("retries transient email failures with exponential backoff and succeeds when a retry passes", async () => {
    const delays: number[] = [];
    const sleep = jest.fn(async (ms: number) => {
      delays.push(ms);
    });

    let callCount = 0;
    const sendFn = jest.fn(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Transient SMTP 421 failure #${callCount}`);
      }
      return true;
    });

    const outcome = await executeEmailWithRetryAndDeadLetter(sendFn, {
      emailType: "waitlist_welcome",
      recipientEmail: "retry@example.com",
      subject: "Welcome",
      maxRetries: 2,
      initialBackoffMs: 100,
      backoffFactor: 2,
      sleep,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.attempts).toBe(3);
    expect(outcome.deadLettered).toBe(false);
    expect(delays).toEqual([100, 200]);
    expect(getInMemoryEmailDeadLetters()).toHaveLength(0);
  });

  it("records a reviewable dead-letter entry and fires an operational alert when all retries fail", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const sendFn = jest
      .fn()
      .mockRejectedValue(new Error("SMTP connection refused permanently"));

    const outcome = await executeEmailWithRetryAndDeadLetter(sendFn, {
      emailType: "waitlist_welcome",
      recipientEmail: "failed@example.com",
      subject: "Your StreamFi Waitlist Confirmation",
      payload: { name: "Alice" },
      maxRetries: 2,
      initialBackoffMs: 50,
      sleep,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.attempts).toBe(3);
    expect(outcome.deadLettered).toBe(true);
    expect(outcome.error).toBe("SMTP connection refused permanently");
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);

    // Verify in-memory reviewable record
    const inMemory = getInMemoryEmailDeadLetters();
    expect(inMemory).toHaveLength(1);
    expect(inMemory[0]).toMatchObject({
      id: 101,
      emailType: "waitlist_welcome",
      recipientEmail: "failed@example.com",
      subject: "Your StreamFi Waitlist Confirmation",
      payload: { name: "Alice" },
      attempts: 3,
      lastError: "SMTP connection refused permanently",
    });

    // Verify DB persistence was invoked on transactional_email_dead_letters
    expect(mockSql).toHaveBeenCalledTimes(1);
    const sqlStrings = mockSql.mock.calls[0][0] as TemplateStringsArray;
    expect(sqlStrings.join(" ")).toContain(
      "INSERT INTO transactional_email_dead_letters"
    );

    // Verify operational alert was dispatched
    expect(mockSendOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "transactional_email",
        event: "transactional_email_dead_lettered",
        details: expect.objectContaining({
          email_type: "waitlist_welcome",
          recipient_email: "failed@example.com",
          attempts: 3,
        }),
      })
    );
  });

  it("treats a false return value from sendWelcomeEmail as a failure and retries", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const sendFn = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const outcome = await executeEmailWithRetryAndDeadLetter(sendFn, {
      emailType: "waitlist_welcome",
      recipientEmail: "bool@example.com",
      subject: "Waitlist",
      maxRetries: 2,
      sleep,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("waitlist subscribe route retries welcome email and records dead letter without failing the HTTP 201 response", async () => {
    // 1. SELECT existing subscriber -> empty
    mockSql.mockResolvedValueOnce({ rows: [] });
    // 2. INSERT subscriber -> ok
    mockSql.mockResolvedValueOnce({ rows: [] });
    // 3. Dead-letter INSERT -> id 55
    mockSql.mockResolvedValueOnce({ rows: [{ id: 55 }] });

    mockSendWelcomeEmail.mockRejectedValue(new Error("Gmail quota exceeded"));

    const req = new NextRequest(
      "http://localhost:3000/api/waitlist/subscribe",
      {
        method: "POST",
        body: JSON.stringify({ email: "waitlist@example.com", name: "Bob" }),
      }
    );

    const res = await waitlistSubscribe(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Wait for background retry loop to finish
    await new Promise(resolve => setTimeout(resolve, 900));

    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(3);
    const deadLetters = getInMemoryEmailDeadLetters();
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toMatchObject({
      emailType: "waitlist_welcome",
      recipientEmail: "waitlist@example.com",
      attempts: 3,
      lastError: "Gmail quota exceeded",
    });
  });

  it("lists dead letters from database or falls back to in-memory buffer when DB is unavailable", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    mockSql.mockRejectedValue(new Error("DB offline"));

    await executeEmailWithRetryAndDeadLetter(
      async () => {
        throw new Error("SMTP timeout");
      },
      {
        emailType: "password_reset",
        recipientEmail: "fallback@example.com",
        subject: "Reset password",
        maxRetries: 1,
        sleep,
      }
    );

    const records = await listEmailDeadLetters();
    expect(records).toHaveLength(1);
    expect(records[0].recipientEmail).toBe("fallback@example.com");
    expect(records[0].attempts).toBe(2);
  });

  it("exposes dead-lettered emails through GET /api/admin/email-dead-letters for authorized admins", async () => {
    mockAuthorizeAdmin.mockResolvedValueOnce({
      ok: false,
      admin: null,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      }),
    });

    const unauthReq = new NextRequest(
      "http://localhost:3000/api/admin/email-dead-letters"
    );
    expect((await getAdminEmailDeadLetters(unauthReq)).status).toBe(403);

    mockAuthorizeAdmin.mockResolvedValueOnce({
      ok: true,
      admin: { userId: "admin-1", role: "super_admin", privyId: null },
      response: null,
    });
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 7,
          email_type: "waitlist_welcome",
          recipient_email: "missed@example.com",
          subject: "Your StreamFi Waitlist Confirmation",
          payload: { name: "Charlie" },
          attempts: 3,
          last_error: "550 Temporary mailbox error",
          dead_lettered_at: new Date("2026-11-19T00:00:00Z"),
          resolved_at: null,
        },
      ],
    });

    const adminReq = new NextRequest(
      "http://localhost:3000/api/admin/email-dead-letters?limit=10"
    );
    const res = await getAdminEmailDeadLetters(adminReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deadLetters).toHaveLength(1);
    expect(data.deadLetters[0]).toMatchObject({
      id: 7,
      emailType: "waitlist_welcome",
      recipientEmail: "missed@example.com",
      attempts: 3,
      lastError: "550 Temporary mailbox error",
    });
  });
});
