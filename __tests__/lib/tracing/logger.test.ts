/**
 * @jest-environment node
 */
import {
  logger,
  createLogger,
  serializeError,
  sanitizeFields,
} from "@/lib/logger";
import {
  createTraceContext,
  withTraceContext,
} from "@/lib/tracing/trace-context";

describe("Structured Logger (#1745)", () => {
  const originalEnv = process.env;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LOG_LEVEL;
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it("outputs structured JSON with timestamp, level, message, and custom fields", () => {
    logger.info("Tip transaction processed", {
      route: "POST /api/tips/send",
      amount: "10.0000000",
      asset: "XLM",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: "info",
      message: "Tip transaction processed",
      route: "POST /api/tips/send",
      amount: "10.0000000",
      asset: "XLM",
    });
    expect(typeof parsed.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(parsed.timestamp))).toBe(false);
  });

  it("injects traceId and spanId when executed inside a trace context", () => {
    const ctx = createTraceContext("trace-test-1234");
    withTraceContext(ctx, () => {
      logger.warn("Rate limit approaching", { userId: "u-99" });
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsed.level).toBe("warn");
    expect(parsed.traceId).toBe("trace-test-1234");
    expect(parsed.spanId).toBe(ctx.spanId);
    expect(parsed.userId).toBe("u-99");
  });

  it("serializes Error instances, strings, and structured objects in logger.error", () => {
    const err = Object.assign(new Error("Horizon timeout"), {
      code: "ETIMEDOUT",
    });
    logger.error("Failed to fetch wallet balance", err, {
      route: "GET /api/wallet/balance",
      address: "GABC1234",
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: "error",
      message: "Failed to fetch wallet balance",
      errorName: "Error",
      errorMessage: "Horizon timeout",
      errorCode: "ETIMEDOUT",
      route: "GET /api/wallet/balance",
      address: "GABC1234",
    });
    expect(parsed.errorStack).toContain("Horizon timeout");
  });

  it("redacts sensitive fields such as secrets, tokens, passwords, and private keys", () => {
    logger.info("Authenticating wallet session", {
      userId: "u-1",
      password: "super-secret-password",
      token: "jwt-token-val",
      encrypted_stellar_key: "ckv2:secret",
      secretKey: "S123456789",
      safeField: "visible",
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.userId).toBe("u-1");
    expect(parsed.safeField).toBe("visible");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.encrypted_stellar_key).toBe("[REDACTED]");
    expect(parsed.secretKey).toBe("[REDACTED]");
  });

  it("creates child loggers that inherit and merge base bindings", () => {
    const walletLogger = createLogger({ service: "wallet", version: "1" });
    const routeLogger = walletLogger.child({
      route: "GET /api/wallet/balance",
    });

    routeLogger.debug("Checking balance", { address: "GWALLET1" });

    expect(debugSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(debugSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: "debug",
      service: "wallet",
      version: "1",
      route: "GET /api/wallet/balance",
      message: "Checking balance",
      address: "GWALLET1",
    });
  });

  it("respects LOG_LEVEL filtering", () => {
    process.env.LOG_LEVEL = "warn";

    logger.debug("debug msg");
    logger.info("info msg");
    logger.log("log msg");
    logger.warn("warn msg");
    logger.error("error msg");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("serializeError and sanitizeFields handle nested errors and non-objects cleanly", () => {
    const nested = serializeError({
      error: new Error("DB connection lost"),
      route: "test",
      secret: "hidden",
    });
    expect(nested.errorMessage).toBe("DB connection lost");
    expect(nested.route).toBe("test");
    expect(nested.secret).toBe("[REDACTED]");

    expect(serializeError("plain string error")).toEqual({
      errorMessage: "plain string error",
    });
    expect(serializeError(null)).toEqual({});
    expect(sanitizeFields(undefined)).toEqual({});
  });
});
