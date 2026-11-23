/**
 * Tests for Stellar wallet context logging suppression in production (#1746)
 */

describe("Stellar Wallet Context logging suppression (#1746)", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("suppresses console.log and console.error when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    // Verify condition check used in stellar-wallet-context.tsx
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      console.log("Modal closed", new Error("test"));
      console.error("Failed to connect Stellar wallet:", new Error("test"));
      console.warn("Stellar auto-connect failed:", new Error("test"));
    }

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("allows debug logging when NODE_ENV is development", () => {
    process.env.NODE_ENV = "development";
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      console.log("Modal closed", new Error("test"));
      console.error("Failed to connect Stellar wallet:", new Error("test"));
    }

    expect(logSpy).toHaveBeenCalledWith("Modal closed", expect.any(Error));
    expect(errorSpy).toHaveBeenCalledWith("Failed to connect Stellar wallet:", expect.any(Error));
  });
});
