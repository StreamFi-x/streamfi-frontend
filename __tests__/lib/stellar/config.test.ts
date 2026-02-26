import { getStellarNetwork, getHorizonUrl, getNetworkPassphrase, StellarNetwork } from "@/lib/stellar/config";
import { Networks } from "@stellar/stellar-sdk";

describe("Stellar Network Configuration", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        jest.spyOn(console, "warn").mockImplementation(() => { });
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    describe("getStellarNetwork", () => {
        it("returns testnet for valid testnet value", () => {
            process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
            expect(getStellarNetwork()).toBe("testnet");
            expect(console.warn).not.toHaveBeenCalled();
        });

        it("returns mainnet for valid mainnet value", () => {
            process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
            expect(getStellarNetwork()).toBe("mainnet");
            expect(console.warn).not.toHaveBeenCalled();
        });

        it("defaults to testnet and warns for invalid value", () => {
            process.env.NEXT_PUBLIC_STELLAR_NETWORK = "invalid-network";
            expect(getStellarNetwork()).toBe("testnet");
            expect(console.warn).toHaveBeenCalledWith(
                "Invalid STELLAR_NETWORK: invalid-network. Defaulting to testnet."
            );
        });

        it("defaults to testnet and warns for missing value", () => {
            delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
            expect(getStellarNetwork()).toBe("testnet");
            expect(console.warn).toHaveBeenCalledWith(
                "Invalid STELLAR_NETWORK: undefined. Defaulting to testnet."
            );
        });
    });

    describe("getHorizonUrl", () => {
        it("returns correct Horizon URL for testnet", () => {
            expect(getHorizonUrl("testnet")).toBe("https://horizon-testnet.stellar.org");
        });

        it("returns correct Horizon URL for mainnet", () => {
            expect(getHorizonUrl("mainnet")).toBe("https://horizon.stellar.org");
        });
    });

    describe("getNetworkPassphrase", () => {
        it("returns correct passphrase for testnet", () => {
            expect(getNetworkPassphrase("testnet")).toBe(Networks.TESTNET);
        });

        it("returns correct passphrase for mainnet", () => {
            expect(getNetworkPassphrase("mainnet")).toBe(Networks.PUBLIC);
        });
    });
});
