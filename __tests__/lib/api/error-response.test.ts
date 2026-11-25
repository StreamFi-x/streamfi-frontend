/**
 * @jest-environment node
 */
import { createSanitizedErrorResponse, INTERNAL_ERROR_MESSAGE } from "@/lib/api/error-response";

describe("createSanitizedErrorResponse structured logging", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs structured JSON error with context and status while returning sanitized body", async () => {
    const err = new Error("DB connection refused");
    const response = createSanitizedErrorResponse(err, {
      context: "POST /api/tips/send",
      publicMessage: "Unable to process request",
      status: 503,
      extra: { retryable: true },
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      error: "Unable to process request",
      retryable: true,
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: "error",
      message: "API error response",
      context: "POST /api/tips/send",
      status: 503,
      errorName: "Error",
      errorMessage: "DB connection refused",
    });
  });

  it("uses default status 500 and default public message when omitted", async () => {
    const response = createSanitizedErrorResponse("boom", {
      context: "GET /api/wallet/balance",
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: INTERNAL_ERROR_MESSAGE });

    const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: "error",
      message: "API error response",
      context: "GET /api/wallet/balance",
      status: 500,
      errorMessage: "boom",
    });
  });
});
