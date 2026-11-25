/**
 * Proactive Stellar wallet extension detection.
 *
 * Checks upfront whether each supported Stellar wallet is installed / ready
 * in the current browser environment rather than waiting for a connection
 * attempt to fail.
 */

export type WalletAvailability = "installed" | "web" | "not_installed";

export interface StellarWalletOption {
  id: string;
  name: string;
  description: string;
  installUrl?: string;
  /** True for web-based wallets that require no browser extension install. */
  isWebWallet?: boolean;
}

export const STELLAR_WALLETS: StellarWalletOption[] = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension",
    installUrl: "https://freighter.app/",
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Browser extension + PWA",
    installUrl: "https://xbull.app/",
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web-based · no install needed",
    installUrl: "https://albedo.link/",
    isWebWallet: true,
  },
  {
    id: "lobstr",
    name: "Lobstr",
    description: "Mobile + browser extension",
    installUrl: "https://lobstr.co/",
  },
  {
    id: "hana",
    name: "Hana",
    description: "Browser extension",
    installUrl: "https://hanawallet.app/",
  },
  {
    id: "hot",
    name: "Hot Wallet",
    description: "Browser extension",
    installUrl: "https://hotwallet.app/",
  },
];

type WindowWithWallets = Window & {
  freighterApi?: unknown;
  freighter?: unknown;
  xBullSDK?: unknown;
  xbull?: unknown;
  hanaWallet?: { stellar?: unknown } | unknown;
  lobstrSignerExtension?: unknown;
  lobstr?: unknown;
  hotWallet?: unknown;
  hereWallet?: unknown;
};

/**
 * Synchronously checks whether a known global object injected by the wallet's
 * browser extension is present on `window`.
 */
export function detectWalletSync(
  walletId: string,
  win: WindowWithWallets | undefined = typeof window !== "undefined"
    ? (window as WindowWithWallets)
    : undefined
): WalletAvailability {
  const option = STELLAR_WALLETS.find(w => w.id === walletId);
  if (option?.isWebWallet) {
    return "web";
  }

  if (!win) {
    return "not_installed";
  }

  switch (walletId) {
    case "freighter":
      return win.freighterApi || win.freighter ? "installed" : "not_installed";
    case "xbull":
      return win.xBullSDK || win.xbull ? "installed" : "not_installed";
    case "hana": {
      const hana = win.hanaWallet as { stellar?: unknown } | undefined;
      return hana && (hana.stellar || hana) ? "installed" : "not_installed";
    }
    case "lobstr":
      return win.lobstrSignerExtension || win.lobstr
        ? "installed"
        : "not_installed";
    case "hot":
      return win.hotWallet || win.hereWallet ? "installed" : "not_installed";
    default:
      return "not_installed";
  }
}

/**
 * Synchronously detects availability for all supported wallets.
 */
export function detectAllWalletsSync(
  win: WindowWithWallets | undefined = typeof window !== "undefined"
    ? (window as WindowWithWallets)
    : undefined
): Record<string, WalletAvailability> {
  const result: Record<string, WalletAvailability> = {};
  for (const wallet of STELLAR_WALLETS) {
    result[wallet.id] = detectWalletSync(wallet.id, win);
  }
  return result;
}

export interface WalletKitLike {
  getSupportedWallets?: () => Promise<
    Array<{ id: string; isAvailable?: boolean }>
  >;
}

/**
 * Runs synchronous global detection and enriches the results with the
 * StellarWalletsKit's async module availability checks (which cover extensions
 * using postMessage/content-script bridges such as newer Freighter versions).
 */
export async function detectInstalledWallets(
  kit?: WalletKitLike | null,
  win: WindowWithWallets | undefined = typeof window !== "undefined"
    ? (window as WindowWithWallets)
    : undefined
): Promise<Record<string, WalletAvailability>> {
  const availability = detectAllWalletsSync(win);

  if (kit && typeof kit.getSupportedWallets === "function") {
    try {
      const supported = await kit.getSupportedWallets();
      for (const entry of supported) {
        const option = STELLAR_WALLETS.find(w => w.id === entry.id);
        if (!option) {
          continue;
        }
        if (option.isWebWallet) {
          availability[entry.id] = "web";
        } else if (entry.isAvailable === true) {
          availability[entry.id] = "installed";
        }
      }
    } catch {
      // Fall back silently to synchronous window global detection
    }
  }

  return availability;
}

/**
 * Sorts wallets so installed / ready-to-connect wallets appear first,
 * followed by web wallets, followed by wallets that require installation.
 */
export function sortWalletsByAvailability(
  wallets: StellarWalletOption[],
  availability: Record<string, WalletAvailability>
): StellarWalletOption[] {
  const rank = (status: WalletAvailability | undefined): number => {
    if (status === "installed") {
      return 0;
    }
    if (status === "web") {
      return 1;
    }
    return 2;
  };

  return [...wallets].sort(
    (a, b) => rank(availability[a.id]) - rank(availability[b.id])
  );
}
