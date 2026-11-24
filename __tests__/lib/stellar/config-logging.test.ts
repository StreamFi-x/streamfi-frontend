/**
 * @jest-environment node
 */
jest.mock("@/lib/stellar/network-guard", () => ({}));

import { getStellarNetwork } from "@/lib/stellar/config";

describe("stellar config structured logging", () => {
  const originalEnv = process.env;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it("emits a structured warning when NEXT_PUBLIC_STELLAR_NETWORK is invalid", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "invalid-net";

    const network = getStellarNetwork();

    expect(network).toBe("testnet");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: "warn",
      module: "stellar/config",
      network: "invalid-net",
    });
  });

  it("does not emit a warning for valid networks", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    expect(getStellarNetwork()).toBe("testnet");

    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    expect(getStellarNetwork()).toBe("mainnet");

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
