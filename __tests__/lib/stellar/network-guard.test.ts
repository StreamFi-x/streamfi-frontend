import {
  assertMainnetAllowedForTransaction,
  getDeploymentContext,
  getMainnetGuardState,
  isMainnetConfigured,
  MainnetBlockedError,
} from "@/lib/stellar/network-guard";

describe("lib/stellar/network-guard", () => {
  describe("isMainnetConfigured", () => {
    it("returns true for mainnet, pubnet, and public (case-insensitive)", () => {
      expect(
        isMainnetConfigured({ NEXT_PUBLIC_STELLAR_NETWORK: "mainnet" })
      ).toBe(true);
      expect(
        isMainnetConfigured({ NEXT_PUBLIC_STELLAR_NETWORK: "MAINNET" })
      ).toBe(true);
      expect(
        isMainnetConfigured({ NEXT_PUBLIC_STELLAR_NETWORK: "pubnet" })
      ).toBe(true);
      expect(
        isMainnetConfigured({ NEXT_PUBLIC_STELLAR_NETWORK: " public " })
      ).toBe(true);
    });

    it("returns false for testnet, empty, or unset values", () => {
      expect(
        isMainnetConfigured({ NEXT_PUBLIC_STELLAR_NETWORK: "testnet" })
      ).toBe(false);
      expect(isMainnetConfigured({ NEXT_PUBLIC_STELLAR_NETWORK: "" })).toBe(
        false
      );
      expect(isMainnetConfigured({})).toBe(false);
    });
  });

  describe("getDeploymentContext", () => {
    it("prioritizes NEXT_PUBLIC_VERCEL_ENV and VERCEL_ENV", () => {
      expect(
        getDeploymentContext({
          NEXT_PUBLIC_VERCEL_ENV: "preview",
          VERCEL_ENV: "production",
          NODE_ENV: "production",
        })
      ).toBe("preview");

      expect(
        getDeploymentContext({
          VERCEL_ENV: "production",
          NODE_ENV: "development",
/**
 * @jest-environment node
 */
import { Keypair, Transaction } from "@stellar/stellar-sdk";
import {
  MainnetBlockedError,
  assertMainnetAllowedForTransaction,
  getDeploymentContext,
  getStellarNetworkGuardState,
  isNonProductionDeployment,
} from "@/lib/stellar/network-guard";
import { buildTransakConfig } from "@/lib/transak/config";

const mockLoadAccount = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => ({
        loadAccount: mockLoadAccount,
        submitTransaction: mockSubmitTransaction,
      })),
    },
  };
});

import {
  buildTipTransaction,
  buildUsdcTipTransaction,
  submitTransaction,
} from "@/lib/stellar/payments";

describe("Stellar network guard (#1716)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("getDeploymentContext", () => {
    it("prioritizes VERCEL_ENV=preview even when NODE_ENV=production", () => {
      expect(
        getDeploymentContext({
          env: { VERCEL_ENV: "preview", NODE_ENV: "production" },
          hostname: "www.streamfi.media",
        })
      ).toBe("preview");
    });

    it("detects NEXT_PUBLIC_VERCEL_ENV=preview", () => {
      expect(
        getDeploymentContext({
          env: { NEXT_PUBLIC_VERCEL_ENV: "preview", NODE_ENV: "production" },
          hostname: "",
        })
      ).toBe("preview");
    });

    it("detects explicit VERCEL_ENV=production", () => {
      expect(
        getDeploymentContext({
          env: { VERCEL_ENV: "production", NODE_ENV: "production" },
          hostname: "www.streamfi.media",
        })
      ).toBe("production");
    });

    it("maps staging to preview", () => {
      expect(getDeploymentContext({ NEXT_PUBLIC_APP_ENV: "staging" })).toBe(
        "preview"
      );
    });

    it("infers preview from *.vercel.app hostname and development from localhost", () => {
      expect(
        getDeploymentContext({}, "streamfi-git-feature-abc.vercel.app")
      ).toBe("preview");
      expect(getDeploymentContext({}, "localhost")).toBe("development");
      expect(getDeploymentContext({}, "127.0.0.1")).toBe("development");
    });

    it("falls back to NODE_ENV when explicit env vars and hostname are absent", () => {
      expect(
        getDeploymentContext({ NODE_ENV: "production" }, "streamfi.media")
      ).toBe("production");
      expect(getDeploymentContext({ NODE_ENV: "test" }, "streamfi.media")).toBe(
        "test"
      );
      expect(getDeploymentContext({}, "streamfi.media")).toBe("unknown");
    });
  });

  describe("getMainnetGuardState", () => {
    it("allows mainnet in production without warning or block", () => {
      const state = getMainnetGuardState({
        env: {
          VERCEL_ENV: "production",
          NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        },
    it("detects staging via APP_ENV or NEXT_PUBLIC_APP_ENV", () => {
      expect(
        getDeploymentContext({
          env: { NEXT_PUBLIC_APP_ENV: "staging", NODE_ENV: "production" },
          hostname: "",
        })
      ).toBe("staging");
      expect(
        getDeploymentContext({
          env: { APP_ENV: "staging", NODE_ENV: "production" },
          hostname: "",
        })
      ).toBe("staging");
    });

    it("detects preview and development hostnames when env vars are absent", () => {
      expect(
        getDeploymentContext({
          env: { NODE_ENV: "production" },
          hostname: "streamfi-git-feature-abc.vercel.app",
        })
      ).toBe("preview");
      expect(
        getDeploymentContext({
          env: { NODE_ENV: "production" },
          hostname: "preview.streamfi.media",
        })
      ).toBe("preview");
      expect(
        getDeploymentContext({
          env: { NODE_ENV: "production" },
          hostname: "staging.streamfi.media",
        })
      ).toBe("staging");
      expect(
        getDeploymentContext({
          env: { NODE_ENV: "production" },
          hostname: "localhost",
        })
      ).toBe("development");
    });

    it("falls back to NODE_ENV and returns unknown when nothing is set", () => {
      expect(
        getDeploymentContext({ env: { NODE_ENV: "development" }, hostname: "" })
      ).toBe("development");
      expect(
        getDeploymentContext({ env: { NODE_ENV: "test" }, hostname: "" })
      ).toBe("test");
      expect(getDeploymentContext({ env: {}, hostname: "" })).toBe("unknown");
    });
  });

  describe("isNonProductionDeployment", () => {
    it("treats preview, staging, development, and test as non-production", () => {
      expect(isNonProductionDeployment("preview")).toBe(true);
      expect(isNonProductionDeployment("staging")).toBe(true);
      expect(isNonProductionDeployment("development")).toBe(true);
      expect(isNonProductionDeployment("test")).toBe(true);
      expect(isNonProductionDeployment("production")).toBe(false);
      expect(isNonProductionDeployment("unknown")).toBe(false);
    });
  });

  describe("getStellarNetworkGuardState", () => {
    it("allows mainnet in production without warning or block", () => {
      const state = getStellarNetworkGuardState({
        env: {
          VERCEL_ENV: "production",
          NODE_ENV: "production",
          NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        },
        hostname: "www.streamfi.media",
      });

      expect(state.network).toBe("mainnet");
      expect(state.deploymentContext).toBe("production");
      expect(state.isMainnetInNonProd).toBe(false);
      expect(state.isBlocked).toBe(false);
      expect(state.warningMessage).toBeNull();
    });

    it("allows testnet in preview without warning or block", () => {
      const state = getMainnetGuardState({
        env: {
          VERCEL_ENV: "preview",
          NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        },
      expect(state.isNonProduction).toBe(false);
      expect(state.isUnsafeMainnetConfig).toBe(false);
      expect(state.isTransactionBlocked).toBe(false);
      expect(state.reason).toBeNull();
    });

    it("allows testnet in preview without warning or block", () => {
      const state = getStellarNetworkGuardState({
        env: {
          VERCEL_ENV: "preview",
          NODE_ENV: "production",
          NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        },
        hostname: "streamfi-git-pr.vercel.app",
      });

      expect(state.network).toBe("testnet");
      expect(state.deploymentContext).toBe("preview");
      expect(state.isMainnetInNonProd).toBe(false);
      expect(state.isBlocked).toBe(false);
      expect(state.warningMessage).toBeNull();
    });

    it("flags and blocks mainnet (including pubnet and public aliases) in preview deployments", () => {
      for (const value of ["mainnet", "pubnet", "public"]) {
        const state = getMainnetGuardState({
          env: {
            VERCEL_ENV: "preview",
            NEXT_PUBLIC_STELLAR_NETWORK: value,
          },
      expect(state.isNonProduction).toBe(true);
      expect(state.isUnsafeMainnetConfig).toBe(false);
      expect(state.isTransactionBlocked).toBe(false);
      expect(state.reason).toBeNull();
    });

    it("flags and blocks mainnet (and pubnet alias) in preview deployments", () => {
      for (const value of ["mainnet", "pubnet"]) {
        const state = getStellarNetworkGuardState({
          env: {
            VERCEL_ENV: "preview",
            NODE_ENV: "production",
            NEXT_PUBLIC_STELLAR_NETWORK: value,
          },
          hostname: "",
        });

        expect(state.network).toBe("mainnet");
        expect(state.deploymentContext).toBe("preview");
        expect(state.isMainnetInNonProd).toBe(true);
        expect(state.isBlocked).toBe(true);
        expect(state.warningMessage).toContain("preview");
        expect(state.warningMessage).toContain("blocked");
      }
    });

    it("flags and blocks mainnet in development deployments", () => {
      const state = getMainnetGuardState({
        env: {
          NODE_ENV: "development",
          NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        },
        hostname: "localhost",
      });

      expect(state.isMainnetInNonProd).toBe(true);
      expect(state.isBlocked).toBe(true);
      expect(state.deploymentContext).toBe("development");
    });

    it("still warns loudly when NEXT_PUBLIC_ALLOW_NON_PROD_MAINNET=true overrides the block", () => {
      const state = getMainnetGuardState({
        env: {
          VERCEL_ENV: "preview",
          NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
          NEXT_PUBLIC_ALLOW_NON_PROD_MAINNET: "true",
        },
      });

      expect(state.isMainnetInNonProd).toBe(true);
      expect(state.isBlocked).toBe(false);
      expect(state.warningMessage).toContain("WARNING");
        expect(state.isUnsafeMainnetConfig).toBe(true);
        expect(state.isTransactionBlocked).toBe(true);
        expect(state.overrideEnabled).toBe(false);
        expect(state.reason).toContain("preview");
        expect(state.reason).toContain("NEXT_PUBLIC_STELLAR_NETWORK=testnet");
      }
    });

    it("keeps warning active while unblocking only when explicit override is enabled", () => {
      const state = getStellarNetworkGuardState({
        env: {
          VERCEL_ENV: "preview",
          NODE_ENV: "production",
          NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
          NEXT_PUBLIC_ALLOW_MAINNET_IN_NON_PROD: "true",
        },
        hostname: "",
      });

      expect(state.isUnsafeMainnetConfig).toBe(true);
      expect(state.overrideEnabled).toBe(true);
      expect(state.isTransactionBlocked).toBe(false);
      expect(state.reason).toContain("override enabled");
    });
  });

  describe("assertMainnetAllowedForTransaction", () => {
    it("throws MainnetBlockedError for preview + mainnet", () => {
      expect(() =>
        assertMainnetAllowedForTransaction("mainnet", {
          env: { VERCEL_ENV: "preview" },
          env: { VERCEL_ENV: "preview", NODE_ENV: "production" },
          hostname: "",
        })
      ).toThrow(MainnetBlockedError);
    });

    it("allows testnet in preview and mainnet in production", () => {
      expect(() =>
        assertMainnetAllowedForTransaction("testnet", {
          env: { VERCEL_ENV: "preview" },
          env: { VERCEL_ENV: "preview", NODE_ENV: "production" },
          hostname: "",
        })
      ).not.toThrow();

      expect(() =>
        assertMainnetAllowedForTransaction("mainnet", {
          env: { VERCEL_ENV: "production" },
          env: { VERCEL_ENV: "production", NODE_ENV: "production" },
          hostname: "",
        })
      ).not.toThrow();
    });
  });

  describe("Hard block across payment builders and Transak in preview + mainnet", () => {
    const sender = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();

    beforeEach(() => {
      process.env.VERCEL_ENV = "preview";
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
      process.env.NEXT_PUBLIC_TRANSAK_API_KEY = "sentinel-key";
    });

    it("blocks buildTipTransaction before contacting Horizon", async () => {
      await expect(
        buildTipTransaction({
          sourcePublicKey: sender,
          destinationPublicKey: recipient,
          amount: "5",
          network: "mainnet",
        })
      ).rejects.toThrow(MainnetBlockedError);

      expect(mockLoadAccount).not.toHaveBeenCalled();
    });

    it("blocks buildUsdcTipTransaction before contacting Horizon", async () => {
      await expect(
        buildUsdcTipTransaction({
          sourcePublicKey: sender,
          destinationPublicKey: recipient,
          amount: "5",
          network: "mainnet",
        })
      ).rejects.toThrow(MainnetBlockedError);

      expect(mockLoadAccount).not.toHaveBeenCalled();
    });

    it("blocks submitTransaction before contacting Horizon", async () => {
      const fakeTx = {
        hash: () => Buffer.from("0123456789abcdef", "hex"),
      } as unknown as Transaction;

      const result = await submitTransaction(fakeTx, "mainnet");

      expect(result.success).toBe(false);
      expect(result.resultCode).toBe("MAINNET_BLOCKED");
      expect(result.error).toContain("preview");
      expect(mockSubmitTransaction).not.toHaveBeenCalled();
    });

    it("blocks buildTransakConfig from opening a PRODUCTION widget in preview", () => {
      expect(() => buildTransakConfig(sender)).toThrow(MainnetBlockedError);
    });
  });
});
