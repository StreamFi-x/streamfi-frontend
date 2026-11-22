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
    });
  });

  describe("assertMainnetAllowedForTransaction", () => {
    it("throws MainnetBlockedError for preview + mainnet", () => {
      expect(() =>
        assertMainnetAllowedForTransaction("mainnet", {
          env: { VERCEL_ENV: "preview" },
        })
      ).toThrow(MainnetBlockedError);
    });

    it("allows testnet in preview and mainnet in production", () => {
      expect(() =>
        assertMainnetAllowedForTransaction("testnet", {
          env: { VERCEL_ENV: "preview" },
        })
      ).not.toThrow();

      expect(() =>
        assertMainnetAllowedForTransaction("mainnet", {
          env: { VERCEL_ENV: "production" },
        })
      ).not.toThrow();
    });
  });
});
