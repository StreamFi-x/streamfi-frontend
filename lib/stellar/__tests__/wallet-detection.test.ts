import {
  STELLAR_WALLETS,
  detectWalletSync,
  detectAllWalletsSync,
  detectInstalledWallets,
  sortWalletsByAvailability,
} from "../wallet-detection";

describe("wallet-detection (#1740)", () => {
  it("detects installed browser extensions from injected window globals", () => {
    const mockWin = {
      freighterApi: {},
      xBullSDK: {},
      hanaWallet: { stellar: {} },
    } as unknown as Window;

    expect(detectWalletSync("freighter", mockWin)).toBe("installed");
    expect(detectWalletSync("xbull", mockWin)).toBe("installed");
    expect(detectWalletSync("hana", mockWin)).toBe("installed");
    expect(detectWalletSync("lobstr", mockWin)).toBe("not_installed");
    expect(detectWalletSync("hot", mockWin)).toBe("not_installed");
  });

  it("marks web-based wallets (Albedo) as web without requiring an extension", () => {
    const emptyWin = {} as unknown as Window;
    expect(detectWalletSync("albedo", emptyWin)).toBe("web");
  });

  it("returns not_installed for extension wallets when window is undefined", () => {
    const result = detectAllWalletsSync(undefined);
    expect(result.freighter).toBe("not_installed");
    expect(result.xbull).toBe("not_installed");
    expect(result.albedo).toBe("web");
  });

  it("enriches sync detection with async StellarWalletsKit availability checks", async () => {
    const emptyWin = {} as unknown as Window;
    const mockKit = {
      getSupportedWallets: jest.fn().mockResolvedValue([
        { id: "freighter", isAvailable: true },
        { id: "xbull", isAvailable: false },
        { id: "albedo", isAvailable: true },
      ]),
    };

    const result = await detectInstalledWallets(mockKit, emptyWin);
    expect(result.freighter).toBe("installed");
    expect(result.xbull).toBe("not_installed");
    expect(result.albedo).toBe("web");
  });

  it("falls back to sync detection when kit.getSupportedWallets throws", async () => {
    const mockWin = { lobstrSignerExtension: {} } as unknown as Window;
    const brokenKit = {
      getSupportedWallets: jest.fn().mockRejectedValue(new Error("boom")),
    };

    const result = await detectInstalledWallets(brokenKit, mockWin);
    expect(result.lobstr).toBe("installed");
    expect(result.freighter).toBe("not_installed");
  });

  it("sorts wallets with installed first, web second, and not_installed last", () => {
    const availability = {
      freighter: "not_installed" as const,
      xbull: "installed" as const,
      albedo: "web" as const,
      lobstr: "not_installed" as const,
      hana: "installed" as const,
      hot: "not_installed" as const,
    };

    const sorted = sortWalletsByAvailability(STELLAR_WALLETS, availability);
    expect(sorted.slice(0, 2).map(w => w.id)).toEqual(["xbull", "hana"]);
    expect(sorted[2].id).toBe("albedo");
    expect(
      sorted
        .slice(3)
        .every(
          w =>
            availability[w.id as keyof typeof availability] === "not_installed"
        )
    ).toBe(true);
  });
});
